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
    const usersCollection = mongoose.connection.db.collection('users');
    const objectId = new mongoose.Types.ObjectId(userId);
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
    
    const updated = await Lock.updateActivity(resourceType, resourceId, userId);
    
    return NextResponse.json({
      success: true,
      updated,
      message: updated ? "Aktivität aktualisiert" : "Keine Sperre zum Aktualisieren gefunden"
    });
    
  } catch (error: any) {
    console.error('Fehler beim Aktualisieren der Aktivität:', error);
    return NextResponse.json({
      error: "Fehler beim Aktualisieren der Aktivität"
    }, { status: 500 });
  }
} 