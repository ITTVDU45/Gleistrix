import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs'
import dbConnect from '../../../../lib/dbConnect';
import Lock from '../../../../lib/models/Lock';
import User from '../../../../lib/models/User';
import { getToken } from 'next-auth/jwt';
import mongoose from 'mongoose';

export async function GET(req: NextRequest) {
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
    const objectId = new mongoose.Types.ObjectId(userId);
    const currentUser = await usersCollection.findOne({ _id: objectId });
    
    if (!currentUser) {
      console.log("Benutzer nicht gefunden mit ID:", userId);
      return NextResponse.json({ error: "Benutzer nicht gefunden" }, { status: 404 });
    }
    
    const { searchParams } = new URL(req.url);
    const resourceType = searchParams.get('resourceType');
    const resourceId = searchParams.get('resourceId');
    
    if (!resourceType || !resourceId) {
      return NextResponse.json({ error: "Ressourcentyp und Ressourcen-ID erforderlich" }, { status: 400 });
    }
    
    const lock = await Lock.isLocked(resourceType, resourceId);
    
    if (lock) {
      // Verbesserte Benutzeridentifikation (robust gegenüber ObjectId/String)
      const rawUserId: any = lock.lockedBy?.userId as any;
      let lockUserIdStr: string | null = null;
      if (typeof rawUserId === 'string') {
        lockUserIdStr = rawUserId;
      } else if (rawUserId && typeof rawUserId.toString === 'function') {
        lockUserIdStr = rawUserId.toString();
      } else if (rawUserId && rawUserId._id && typeof rawUserId._id.toString === 'function') {
        lockUserIdStr = rawUserId._id.toString();
      }
      const currentUserId = currentUser._id.toString();
      const isOwnLock = lockUserIdStr === currentUserId;
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`=== SPERRE PRÜFUNG ===`);
        console.log(`Aktueller Benutzer: ${currentUserId} (${currentUser.name})`);
        console.log(`Sperre von: ${lockUserIdStr} (${lock.lockedBy?.name || '-'})`);
        console.log(`Ist eigene Sperre: ${isOwnLock}`);
        console.log(`========================`);
      }
      
      return NextResponse.json({
        success: true,
        isLocked: true,
        isOwnLock,
        lock: {
          id: lock._id,
          resourceType: lock.resourceType,
          resourceId: lock.resourceId,
          lockedBy: lock.lockedBy,
          lockedAt: lock.lockedAt,
          lastActivity: lock.lastActivity
        }
      });
    } else {
      return NextResponse.json({
        success: true,
        isLocked: false,
        lock: null
      });
    }
    
  } catch (error: any) {
    console.error('Fehler beim Prüfen der Sperre:', error);
    return NextResponse.json({
      error: "Fehler beim Prüfen der Sperre"
    }, { status: 500 });
  }
} 