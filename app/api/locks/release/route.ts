import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs'
import dbConnect from '../../../../lib/dbConnect';
import Lock from '../../../../lib/models/Lock';
import User from '../../../../lib/models/User';
import { getToken } from 'next-auth/jwt';
import mongoose from 'mongoose';

export async function POST(req: NextRequest) {
  try {
    await dbConnect();
    // Authentifizierung (optional)
    let currentUser = null;
    let userId = null;
    
    // NextAuth Token aus Request lesen
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    
    if (token?.id) {
      try {
        userId = token.id;
        // Benutzer direkt aus der Collection abrufen
        const db = mongoose.connection.db;
        if (!db) {
          return NextResponse.json({ error: 'Datenbankverbindung nicht verfügbar' }, { status: 500 });
        }
        const usersCollection = db.collection('users');
        const objectId = new mongoose.Types.ObjectId(userId);
        currentUser = await usersCollection.findOne({ _id: objectId });
      } catch (e) {
        console.log("Fehler beim Laden des Benutzers:", e);
        // ignore
      }
    }
    const body = await req.json();
    const { resourceType, resourceId } = body;
    if (process.env.NODE_ENV === 'development') {
      console.log('[API] Sperre-Freigabe-Request erhalten', { resourceType, resourceId, user: currentUser?.name });
    }
    
    if (!resourceType || !resourceId) {
      return NextResponse.json({ error: "Ressourcentyp und Ressourcen-ID erforderlich" }, { status: 400 });
    }
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`=== SPERRE FREIGEBEN ANFORDERUNG ===`);
      console.log(`Ressource: ${resourceType}/${resourceId}`);
      console.log(`Benutzer: ${currentUser?.name} (${currentUser?.role})`);
      console.log(`Zeit: ${new Date().toLocaleString('de-DE')}`);
    }
    
    const Lock = (await import('../../../../lib/models/Lock')).default;
    // Alle Sperren für diese Ressource finden und löschen
    const existingLocks = await Lock.find({
      resourceType,
      resourceId
    });
    
    if (process.env.NODE_ENV === 'development') console.log(`Gefundene Sperren: ${existingLocks.length}`);
    
    if (existingLocks.length > 0) {
      // Alle Sperren für diese Ressource löschen
      const result = await Lock.deleteMany({
        resourceType,
        resourceId
      });
      
      if (process.env.NODE_ENV === 'development') {
        console.log('[API] Sperre erfolgreich freigegeben, sende WebSocket-Update', { deletedCount: result.deletedCount });
        console.log(`Freigegebene Sperren: ${result.deletedCount} für ${resourceType}/${resourceId}`);
        console.log(`===========================`);
      }
      
      // WebSocket-Update senden (falls verfügbar)
      try {
        const { lockWebSocket } = await import('../../../../lib/websocket');
        lockWebSocket.emitLockUpdate(resourceType, resourceId, 'released');
      } catch (error) {
        console.log('[API] WebSocket nicht verfügbar für Lock-Update');
      }
      
      return NextResponse.json({
        success: true,
        message: "Sperre erfolgreich freigegeben",
        releasedCount: result.deletedCount
      });
    } else {
      if (process.env.NODE_ENV === 'development') {
        console.log('[API] Keine Sperre gefunden zum Freigeben', { resourceType, resourceId });
        console.log(`===========================`);
      }
      
      return NextResponse.json({
        success: true,
        message: "Keine Sperre zum Freigeben gefunden",
        releasedCount: 0
      });
    }
    
  } catch (error: any) {
    console.error('[API] Fehler beim Freigeben der Sperre:', error);
    return NextResponse.json({
      error: "Fehler beim Freigeben der Sperre"
    }, { status: 500 });
  }
} 