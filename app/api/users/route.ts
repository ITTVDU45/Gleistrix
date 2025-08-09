import { NextRequest, NextResponse } from "next/server"
import dbConnect from "../../../lib/dbConnect"
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

    // Alle Benutzer laden (außer sich selbst)
    const users = await usersCollection
      .find({ _id: { $ne: objectId } })
      .project({ name: 1, email: 1, role: 1, firstName: 1, lastName: 1, phone: 1, isActive: 1, lastLogin: 1, createdAt: 1 })
      .sort({ createdAt: -1 })
      .toArray();

    return NextResponse.json({ 
      users: users.map((user: any) => ({
        id: user._id?.toString?.() || user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        isActive: user.isActive,
        lastLogin: user.lastLogin,
        createdAt: user.createdAt
      }))
    }, { status: 200 });
    
  } catch (error) {
    console.error('Get users error:', error);
    return NextResponse.json({ 
      error: "Ein Fehler ist aufgetreten" 
    }, { status: 500 });
  }
}