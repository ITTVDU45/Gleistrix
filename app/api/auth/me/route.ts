import { NextRequest, NextResponse } from "next/server"
import dbConnect from "../../../../lib/dbConnect"
import mongoose from "mongoose"
import { getToken } from "next-auth/jwt"

export async function GET(req: NextRequest) {
  try {
    // NextAuth Token aus Request lesen
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    
    if (!token) {
      console.log("Kein gültiges NextAuth-Token gefunden");
      return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
    }

    console.log("NextAuth-Token gefunden:", token);
    
    await dbConnect();
    
    // Benutzer direkt aus der Collection abrufen
    const db = mongoose.connection.db;
    if (!db) {
      return NextResponse.json({ error: 'Datenbankverbindung nicht verfügbar' }, { status: 500 });
    }
    const usersCollection = db.collection('users');
    const userId = token.id;
    
    if (!userId) {
      console.log("Keine Benutzer-ID im Token");
      return NextResponse.json({ error: "Ungültiges Token" }, { status: 401 });
    }
    
    let objectId;
    try {
      objectId = new mongoose.Types.ObjectId(userId);
    } catch (error) {
      console.error("Ungültige Benutzer-ID:", userId, error);
      return NextResponse.json({ error: "Ungültige Benutzer-ID" }, { status: 401 });
    }
    
    const user = await usersCollection.findOne({ _id: objectId });
    
    if (!user) {
      console.log("Benutzer nicht gefunden mit ID:", userId);
      return NextResponse.json({ error: "Benutzer nicht gefunden" }, { status: 401 });
    }

    // Prüfen ob Account aktiv ist
    if (user.isActive === false) {
      console.log("Account ist deaktiviert:", user.email);
      return NextResponse.json({ error: "Account ist deaktiviert" }, { status: 401 });
    }

    console.log('=== BENUTZERDATEN GELADEN ===');
    console.log('Benutzer ID:', user._id);
    console.log('Name:', user.name);
    console.log('E-Mail:', user.email);
    console.log('Rolle:', user.role);
    console.log('============================');

    return NextResponse.json({ 
      user: { 
        id: user._id.toString(),
        email: user.email, 
        name: user.name || '',
        role: user.role || 'user',
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        address: user.address,
        lastLogin: user.lastLogin
      } 
    }, { status: 200 });
    
  } catch (error) {
    console.error('Auth verification error:', error);
    return NextResponse.json({ error: "Ein Fehler ist aufgetreten" }, { status: 500 });
  }
} 