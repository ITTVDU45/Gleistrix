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
    
    // NextAuth Token aus Request lesen
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    
    if (!token) {
      console.log("Kein gültiges NextAuth-Token gefunden");
      return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
    }
    
    const userId = token.id;
    if (!userId) {
      console.log("Keine Benutzer-ID im Token");
      return NextResponse.json({ error: "Ungültiges Token" }, { status: 401 });
    }
    
    // Benutzer direkt aus der Collection abrufen
   const db = mongoose.connection.db;
   if (!db) {
     return NextResponse.json({ error: 'Datenbankverbindung nicht verfügbar' }, { status: 500 });
   }
   const usersCollection = db.collection('users');
    const objectId = new mongoose.Types.ObjectId(String(userId));
    const currentUser = await usersCollection.findOne({ _id: objectId });
    
    if (!currentUser) {
      console.log("Benutzer nicht gefunden mit ID:", userId);
      return NextResponse.json({ error: "Benutzer nicht gefunden" }, { status: 404 });
    }
    
    const body = await req.json();
    const { resourceType, resourceId } = body;
    
    if (!resourceType || !resourceId) {
      return NextResponse.json({ error: "Ressourcentyp und Ressourcen-ID erforderlich" }, { status: 400 });
    }
    
    // Prüfen, ob bereits eine Sperre vom gleichen Benutzer existiert
    const existingLock = await Lock.findOne({
      resourceType,
      resourceId,
      'lockedBy.userId': currentUser._id,
      lastActivity: { $gte: new Date(Date.now() - 15 * 60 * 1000) } // Nur aktive Sperren
    });
    
    if (existingLock) {
      // Aktualisiere die bestehende Sperre
      existingLock.lastActivity = new Date();
      await existingLock.save();
      
      console.log(`=== SPERRE AKTUALISIERT ===`);
      console.log(`Ressource: ${resourceType}/${resourceId}`);
      console.log(`Benutzer: ${currentUser.name} (${currentUser.role})`);
      console.log(`Zeit: ${new Date().toLocaleString('de-DE')}`);
      console.log(`========================`);
      
      return NextResponse.json({
        success: true,
        message: "Bestehende Sperre aktualisiert",
        lock: {
          lockedBy: existingLock.lockedBy
        }
      });
    }
    
    // Prüfen, ob eine andere Sperre existiert
    const otherLock = await Lock.findOne({
      resourceType,
      resourceId,
      lastActivity: { $gte: new Date(Date.now() - 15 * 60 * 1000) } // Nur aktive Sperren
    });
    
    if (otherLock) {
      console.log(`=== SPERRE VERWEIGERT ===`);
      console.log(`Ressource: ${resourceType}/${resourceId}`);
      console.log(`Benutzer: ${currentUser.name} (${currentUser.role})`);
      console.log(`Gesperrt von: ${otherLock.lockedBy.name} (${otherLock.lockedBy.role})`);
      console.log(`Zeit: ${new Date().toLocaleString('de-DE')}`);
      console.log(`========================`);
      
      return NextResponse.json({
        success: false,
        error: "Ressource ist bereits von einem anderen Benutzer gesperrt",
        lockedBy: otherLock.lockedBy
      });
    }
    
    // Neue Sperre erstellen (mit atomischer Transaktion)
    try {
      const lock = await Lock.createLock(
        resourceType,
        resourceId,
        currentUser._id.toString(),
        currentUser.name,
        currentUser.role,
        'session-' + Date.now(), // Einfache Session-ID
        req.headers.get('x-forwarded-for') || 'unknown',
        req.headers.get('user-agent') || 'unknown'
      );
      
      console.log(`=== SPERRE ERWORBEN ===`);
      console.log(`Ressource: ${resourceType}/${resourceId}`);
      console.log(`Benutzer: ${currentUser.name} (${currentUser.role})`);
      console.log(`Zeit: ${new Date().toLocaleString('de-DE')}`);
      console.log(`========================`);
      
      // WebSocket-Update senden (falls verfügbar)
      try {
        const { lockWebSocket } = await import('../../../../lib/websocket');
        lockWebSocket.emitLockUpdate(resourceType, resourceId, 'acquired');
      } catch (error) {
        console.log('WebSocket not available for lock update');
      }
      
      return NextResponse.json({
        success: true,
        message: "Sperre erfolgreich erworben",
        lock: {
          lockedBy: lock.lockedBy
        }
      });
    } catch (error: any) {
      if (error.message === 'Ressource ist bereits von einem anderen Benutzer gesperrt') {
        console.log(`=== SPERRE VERWEIGERT (RACE CONDITION) ===`);
        console.log(`Ressource: ${resourceType}/${resourceId}`);
        console.log(`Benutzer: ${currentUser.name} (${currentUser.role})`);
        console.log(`Zeit: ${new Date().toLocaleString('de-DE')}`);
        console.log(`========================`);
        
        return NextResponse.json({
          success: false,
          error: "Ressource ist bereits von einem anderen Benutzer gesperrt",
          lockedBy: null
        });
      } else {
        throw error;
      }
    }
    
  } catch (error: any) {
    console.error('Fehler beim Erwerben der Sperre:', error);
    return NextResponse.json({
      error: "Fehler beim Erwerben der Sperre"
    }, { status: 500 });
  }
} 