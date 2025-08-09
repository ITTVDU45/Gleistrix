import { NextRequest, NextResponse } from "next/server"
import dbConnect from "../../../../lib/dbConnect"
import InviteToken from "../../../../lib/models/InviteToken"
import mongoose from "mongoose"
import { getToken } from "next-auth/jwt"
import { z } from 'zod'

export async function DELETE(req: NextRequest) {
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
      objectId = new mongoose.Types.ObjectId(String(currentUserId));
    } catch (e) {
      return NextResponse.json({ error: "Ungültige Benutzer-ID" }, { status: 401 });
    }
    const currentUser = await usersCollection.findOne({ _id: objectId });
    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'superadmin')) {
      return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
    }

    // Request-Body parsen
    const csrf = req.headers.get('x-csrf-intent');
    if (process.env.NODE_ENV === 'production' && csrf !== 'invite:delete-all') {
      return NextResponse.json({ error: 'Ungültige Anforderung' }, { status: 400 });
    }
    const schema = z.object({ email: z.string().email() });
    const parseResult = schema.safeParse(await req.json());
    if (!parseResult.success) {
      return NextResponse.json({ error: 'Validierungsfehler', issues: parseResult.error.flatten() }, { status: 400 });
    }
    const { email } = parseResult.data;

    if (!email) {
      return NextResponse.json({ error: "E-Mail ist erforderlich" }, { status: 400 });
    }

    // Alle Einladungen für diese E-Mail löschen (auch gültige)
    const result = await InviteToken.deleteMany({ email });

    console.log('=== ALLE EINLADUNGEN GELÖSCHT ===');
    console.log(`E-Mail: ${email}`);
    console.log(`Gelöschte Einladungen: ${result.deletedCount}`);
    console.log(`Gelöscht von: ${currentUser.name} (${currentUser.role})`);
    console.log('==================================');

    return NextResponse.json({ 
      message: `${result.deletedCount} Einladung(en) gelöscht`,
      deletedCount: result.deletedCount
    }, { status: 200 });
    
  } catch (error) {
    console.error('Delete all invites error:', error);
    return NextResponse.json({ 
      error: "Ein Fehler ist aufgetreten" 
    }, { status: 500 });
  }
} 