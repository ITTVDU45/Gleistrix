import { NextRequest, NextResponse } from "next/server"
import dbConnect from "../../../../lib/dbConnect"
import InviteToken from "../../../../lib/models/InviteToken"
import mongoose from "mongoose"
import { getToken } from "next-auth/jwt"
import { nanoid } from "nanoid"
import User from "../../../../lib/models/User"
import { sendInviteEmail } from "../../../../lib/mailer"
import { z } from 'zod'

export async function POST(req: NextRequest) {
  try {
    await dbConnect();
    
    // NextAuth Token lesen
    const sessionToken = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!sessionToken) {
      return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
    }
    const db = mongoose.connection?.db;
    if (!db) {
      return NextResponse.json({ error: "DB nicht verbunden" }, { status: 500 });
    }
    const usersCollection = db.collection('users');
    const currentUserId = sessionToken.id as string | undefined;
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
      return NextResponse.json({ error: "Nur Admins können Benutzer einladen" }, { status: 403 });
    }

    // Request-Body parsen
    const csrf = req.headers.get('x-csrf-intent');
    if (process.env.NODE_ENV === 'production' && csrf !== 'invite:create-user') {
      return NextResponse.json({ error: 'Ungültige Anforderung' }, { status: 400 });
    }
    const schema = z.object({
      firstName: z.string().min(1),
      lastName: z.string().min(1),
      email: z.string().email(),
      phone: z.string().optional().or(z.literal('')),
    });
    const parseResult = schema.safeParse(await req.json());
    if (!parseResult.success) {
      return NextResponse.json({ error: 'Validierungsfehler', issues: parseResult.error.flatten() }, { status: 400 });
    }
    const { firstName, lastName, email, phone } = parseResult.data;

    // Validierung
    if (!firstName || !lastName || !email) {
      return NextResponse.json({ error: "Vorname, Nachname und E-Mail sind erforderlich" }, { status: 400 });
    }

    // E-Mail-Format validieren
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "Ungültige E-Mail-Adresse" }, { status: 400 });
    }

    // Prüfen ob Benutzer bereits existiert
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return NextResponse.json({ error: "Ein Benutzer mit dieser E-Mail existiert bereits" }, { status: 409 });
    }

    // Prüfen ob bereits eine Einladung für diese E-Mail existiert
    const existingInvite = await InviteToken.findOne({ 
      email, 
      used: false,
      expiresAt: { $gt: new Date() } // Nur nicht abgelaufene Einladungen
    });
    
    if (existingInvite) {
      return NextResponse.json({ 
        error: "Eine gültige Einladung für diese E-Mail wurde bereits gesendet",
        message: "Die Einladung ist noch 24 Stunden gültig. Bitte warten Sie, bis sie abgelaufen ist."
      }, { status: 409 });
    }

    // Abgelaufene oder verwendete Einladungen für diese E-Mail löschen
    await InviteToken.deleteMany({ 
      email,
      $or: [
        { used: true },
        { expiresAt: { $lt: new Date() } }
      ]
    });

    // Eindeutigen Token generieren
    const inviteTokenValue = nanoid(32);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 Stunden

    // Einladung in Datenbank speichern
    const inviteToken = new InviteToken({
      email,
      role: 'user',
      token: inviteTokenValue,
      used: false,
      expiresAt,
      createdBy: currentUser._id,
      name: `${firstName} ${lastName}`,
      firstName,
      lastName,
      phone
    });

    await inviteToken.save();

    // E-Mail-Einladung senden
    const inviteLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/set-password?token=${inviteTokenValue}`;
    const emailSent = await sendInviteEmail(email, `${firstName} ${lastName}`, 'user', inviteLink, expiresAt);

    if (emailSent) {
      console.log('=== USER EINLADUNG GESENDET ===');
      console.log(`An: ${email}`);
      console.log(`Name: ${firstName} ${lastName}`);
      console.log(`Telefon: ${phone || 'Nicht angegeben'}`);
      console.log(`Rolle: Benutzer`);
      console.log(`Token: ${inviteTokenValue}`);
      console.log(`Link: ${inviteLink}`);
      console.log(`Gültig bis: ${expiresAt.toLocaleString('de-DE')}`);
      console.log('==================================');
    } else {
      console.log('=== E-MAIL VERSAND FEHLGESCHLAGEN ===');
      console.log(`An: ${email}`);
      console.log(`Name: ${firstName} ${lastName}`);
      console.log(`Token: ${inviteTokenValue}`);
      console.log(`Link: ${inviteLink}`);
      console.log(`Gültig bis: ${expiresAt.toLocaleString('de-DE')}`);
      console.log('=====================================');
    }

    return NextResponse.json({ 
      message: "Benutzer-Einladung erfolgreich gesendet",
      invite: {
        email,
        name: `${firstName} ${lastName}`,
        role: 'user',
        expiresAt
      }
    }, { status: 201 });
    
  } catch (error) {
    console.error('Create user invite error:', error);
    return NextResponse.json({ 
      error: "Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut." 
    }, { status: 500 });
  }
} 