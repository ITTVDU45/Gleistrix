import { getErrorMessage } from '@/lib/errors'
import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs'
import dbConnect from '@/lib/dbConnect';
import Lock from '@/lib/models/Lock';
import mongoose from 'mongoose';
import { envSuperadminDisplayName } from '../../../../lib/auth/envSuperadmin';
import { resolveLockUser } from '../../../../lib/auth/resolveLockUser';

export async function POST(req: NextRequest) {
  try {
    await dbConnect();

    const resolvedUser = await resolveLockUser(req);
    if (!resolvedUser.ok) {
      return NextResponse.json({ error: resolvedUser.error }, { status: resolvedUser.status });
    }

    const db = mongoose.connection.db;
    if (!db) {
      return NextResponse.json({ error: 'Datenbankverbindung nicht verfuegbar' }, { status: 500 });
    }
    const usersCollection = db.collection('users');

    let currentUser: any = resolvedUser.userDoc || null;

    if (!currentUser && resolvedUser.isEnvSuperadmin) {
      currentUser = {
        _id: new mongoose.Types.ObjectId(resolvedUser.effectiveUserId),
        name: envSuperadminDisplayName(),
        role: 'superadmin'
      };
    }

    if (!currentUser) {
      let objectId: mongoose.Types.ObjectId;
      try {
        objectId = new mongoose.Types.ObjectId(String(resolvedUser.effectiveUserId));
      } catch {
        return NextResponse.json({ error: 'Ungueltige Benutzer-ID' }, { status: 401 });
      }
      currentUser = await usersCollection.findOne({ _id: objectId });
    }

    if (!currentUser) {
      logger.debug('Benutzer nicht gefunden mit ID:', resolvedUser.effectiveUserId);
      return NextResponse.json({ error: 'Benutzer nicht gefunden' }, { status: 404 });
    }

    const currentUserName = currentUser.name || currentUser.email || envSuperadminDisplayName();
    const currentUserRole = currentUser.role || (resolvedUser.isEnvSuperadmin ? 'superadmin' : 'user');

    const body = await req.json();
    const { resourceType, resourceId } = body;

    if (!resourceType || !resourceId) {
      return NextResponse.json({ error: 'Ressourcentyp und Ressourcen-ID erforderlich' }, { status: 400 });
    }

    const existingLock = await Lock.findOne({
      resourceType,
      resourceId,
      'lockedBy.userId': currentUser._id,
      lastActivity: { $gte: new Date(Date.now() - 15 * 60 * 1000) }
    });

    if (existingLock) {
      existingLock.lastActivity = new Date();
      await existingLock.save();

      logger.debug('=== SPERRE AKTUALISIERT ===');
      logger.debug(`Ressource: ${resourceType}/${resourceId}`);
      logger.debug(`Benutzer: ${currentUserName} (${currentUserRole})`);
      logger.debug(`Zeit: ${new Date().toLocaleString('de-DE')}`);
      logger.debug('========================');

      return NextResponse.json({
        success: true,
        message: 'Bestehende Sperre aktualisiert',
        lock: {
          lockedBy: existingLock.lockedBy
        }
      });
    }

    const otherLock = await Lock.findOne({
      resourceType,
      resourceId,
      lastActivity: { $gte: new Date(Date.now() - 15 * 60 * 1000) }
    });

    if (otherLock) {
      logger.debug('=== SPERRE VERWEIGERT ===');
      logger.debug(`Ressource: ${resourceType}/${resourceId}`);
      logger.debug(`Benutzer: ${currentUserName} (${currentUserRole})`);
      logger.debug(`Gesperrt von: ${otherLock.lockedBy.name} (${otherLock.lockedBy.role})`);
      logger.debug(`Zeit: ${new Date().toLocaleString('de-DE')}`);
      logger.debug('========================');

      return NextResponse.json({
        success: false,
        error: 'Ressource ist bereits von einem anderen Benutzer gesperrt',
        lockedBy: otherLock.lockedBy
      });
    }

    try {
      const lock = await Lock.createLock(
        resourceType,
        resourceId,
        currentUser._id.toString(),
        currentUserName,
        currentUserRole,
        'session-' + Date.now(),
        req.headers.get('x-forwarded-for') || 'unknown',
        req.headers.get('user-agent') || 'unknown'
      );

      logger.debug('=== SPERRE ERWORBEN ===');
      logger.debug(`Ressource: ${resourceType}/${resourceId}`);
      logger.debug(`Benutzer: ${currentUserName} (${currentUserRole})`);
      logger.debug(`Zeit: ${new Date().toLocaleString('de-DE')}`);
      logger.debug('========================');

      try {
        const { lockWebSocket } = await import('../../../../lib/websocket');
        lockWebSocket.emitLockUpdate(resourceType, resourceId, 'acquired');
      } catch (error) {
        logger.debug('WebSocket not available for lock update');
      }

      return NextResponse.json({
        success: true,
        message: 'Sperre erfolgreich erworben',
        lock: {
          lockedBy: lock.lockedBy
        }
      });
    } catch (error: unknown) {
      if (getErrorMessage(error) === 'Ressource ist bereits von einem anderen Benutzer gesperrt') {
        logger.debug('=== SPERRE VERWEIGERT (RACE CONDITION) ===');
        logger.debug(`Ressource: ${resourceType}/${resourceId}`);
        logger.debug(`Benutzer: ${currentUserName} (${currentUserRole})`);
        logger.debug(`Zeit: ${new Date().toLocaleString('de-DE')}`);
        logger.debug('========================');

        return NextResponse.json({
          success: false,
          error: 'Ressource ist bereits von einem anderen Benutzer gesperrt',
          lockedBy: null
        });
      } else {
        throw error;
      }
    }
  } catch (error: unknown) {
    logger.error('Fehler beim Erwerben der Sperre:', error);
    return NextResponse.json({
      error: 'Fehler beim Erwerben der Sperre'
    }, { status: 500 });
  }
}