import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs'
import dbConnect from '../../../../lib/dbConnect';
import Lock from '../../../../lib/models/Lock';
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
      console.log('Benutzer nicht gefunden mit ID:', resolvedUser.effectiveUserId);
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

      console.log('=== SPERRE AKTUALISIERT ===');
      console.log(`Ressource: ${resourceType}/${resourceId}`);
      console.log(`Benutzer: ${currentUserName} (${currentUserRole})`);
      console.log(`Zeit: ${new Date().toLocaleString('de-DE')}`);
      console.log('========================');

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
      console.log('=== SPERRE VERWEIGERT ===');
      console.log(`Ressource: ${resourceType}/${resourceId}`);
      console.log(`Benutzer: ${currentUserName} (${currentUserRole})`);
      console.log(`Gesperrt von: ${otherLock.lockedBy.name} (${otherLock.lockedBy.role})`);
      console.log(`Zeit: ${new Date().toLocaleString('de-DE')}`);
      console.log('========================');

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

      console.log('=== SPERRE ERWORBEN ===');
      console.log(`Ressource: ${resourceType}/${resourceId}`);
      console.log(`Benutzer: ${currentUserName} (${currentUserRole})`);
      console.log(`Zeit: ${new Date().toLocaleString('de-DE')}`);
      console.log('========================');

      try {
        const { lockWebSocket } = await import('../../../../lib/websocket');
        lockWebSocket.emitLockUpdate(resourceType, resourceId, 'acquired');
      } catch (error) {
        console.log('WebSocket not available for lock update');
      }

      return NextResponse.json({
        success: true,
        message: 'Sperre erfolgreich erworben',
        lock: {
          lockedBy: lock.lockedBy
        }
      });
    } catch (error: any) {
      if (error.message === 'Ressource ist bereits von einem anderen Benutzer gesperrt') {
        console.log('=== SPERRE VERWEIGERT (RACE CONDITION) ===');
        console.log(`Ressource: ${resourceType}/${resourceId}`);
        console.log(`Benutzer: ${currentUserName} (${currentUserRole})`);
        console.log(`Zeit: ${new Date().toLocaleString('de-DE')}`);
        console.log('========================');

        return NextResponse.json({
          success: false,
          error: 'Ressource ist bereits von einem anderen Benutzer gesperrt',
          lockedBy: null
        });
      } else {
        throw error;
      }
    }
  } catch (error: any) {
    console.error('Fehler beim Erwerben der Sperre:', error);
    return NextResponse.json({
      error: 'Fehler beim Erwerben der Sperre'
    }, { status: 500 });
  }
}