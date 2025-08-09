import { NextRequest, NextResponse } from "next/server"
import dbConnect from "../../../../lib/dbConnect"
import InviteToken from "../../../../lib/models/InviteToken"
import mongoose from "mongoose"
import { getToken } from "next-auth/jwt"

export async function GET(req: NextRequest) {
  try {
    await dbConnect();
    
    // NextAuth Token lesen
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token) {
      return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
    }
    const db = mongoose.connection.db;
    if (!db) {
      return NextResponse.json({ error: 'Datenbankverbindung nicht verfügbar' }, { status: 500 });
    }
    const usersCollection = db.collection('users');
    const currentUserId = token.id as string | undefined;
    if (!currentUserId) {
      return NextResponse.json({ error: "Ungültiges Token" }, { status: 401 });
    }
    let objectId;
    try {
      objectId = new mongoose.Types.ObjectId(currentUserId);
    } catch (e) {
      return NextResponse.json({ error: "Ungültige Benutzer-ID" }, { status: 401 });
    }
    const currentUser = await usersCollection.findOne({ _id: objectId });
    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'superadmin')) {
      return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
    }

    // Nur nicht verwendete Einladungen laden
    const invites = await InviteToken.find({ used: false })
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 });

    console.log('=== EINLADUNGEN GELADEN ===');
    console.log(`Anzahl: ${invites.length}`);
    console.log(`Geladen von: ${currentUser.name} (${currentUser.role})`);
    console.log('==========================');

    return NextResponse.json({ 
      invites: invites.map((invite: any) => ({
        id: invite._id,
        email: invite.email,
        name: invite.name,
        role: invite.role,
        firstName: invite.firstName,
        lastName: invite.lastName,
        phone: invite.phone,
        used: invite.used,
        expiresAt: invite.expiresAt,
        createdAt: invite.createdAt,
        createdBy: invite.createdBy?.name || 'Unbekannt'
      }))
    }, { status: 200 });
    
  } catch (error) {
    console.error('Get invites error:', error);
    return NextResponse.json({ 
      error: "Ein Fehler ist aufgetreten" 
    }, { status: 500 });
  }
} 