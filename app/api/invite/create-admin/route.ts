import { NextRequest, NextResponse } from "next/server"
import dbConnect from "../../../../lib/dbConnect"
import InviteToken from "../../../../lib/models/InviteToken"
import User from "../../../../lib/models/User"
import { nanoid } from "nanoid"
import { sendInviteEmail } from "../../../../lib/mailer"
import { getCurrentUser } from "../../../../lib/auth/getCurrentUser"
import { z } from 'zod'

export async function POST(req: NextRequest) {
  try {
    await dbConnect();
    
    const currentUser = await getCurrentUser(req);
    if (!currentUser) {
      return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
    }
    // Prüfen ob eingeloggter Benutzer Superadmin oder Admin ist
    if (!currentUser || (currentUser.role !== 'superadmin' && currentUser.role !== 'admin')) {
      return NextResponse.json({ error: "Nur Superadmins und Admins können Admins einladen" }, { status: 403 });
    }

    // Request-Body parsen
    const csrf = req.headers.get('x-csrf-intent');
    if (process.env.NODE_ENV === 'production' && csrf !== 'invite:create-admin') {
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
    const token = nanoid(32);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 Stunden

    // Einladung in Datenbank speichern
    const inviteToken = new InviteToken({
      email,
      role: 'admin',
      token,
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
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
    const inviteLink = `${baseUrl}/auth/set-password?token=${token}`;
    const emailSent = await sendInviteEmail(email, `${firstName} ${lastName}`, 'admin', inviteLink, expiresAt);

    if (emailSent) {
      console.log('=== ADMIN EINLADUNG GESENDET ===');
      console.log(`An: ${email}`);
      console.log(`Name: ${firstName} ${lastName}`);
      console.log(`Telefon: ${phone || 'Nicht angegeben'}`);
      console.log(`Rolle: Admin`);
      console.log(`Token: ${token}`);
      console.log(`Link: ${inviteLink}`);
      console.log(`Gültig bis: ${expiresAt.toLocaleString('de-DE')}`);
      console.log('==================================');
    } else {
      console.log('=== E-MAIL VERSAND FEHLGESCHLAGEN ===');
      console.log(`An: ${email}`);
      console.log(`Name: ${firstName} ${lastName}`);
      console.log(`Token: ${token}`);
      console.log(`Link: ${inviteLink}`);
      console.log(`Gültig bis: ${expiresAt.toLocaleString('de-DE')}`);
      console.log('=====================================');
    }

    return NextResponse.json({ 
      message: "Admin-Einladung erfolgreich gesendet",
      invite: {
        email,
        name: `${firstName} ${lastName}`,
        role: 'admin',
        expiresAt
      }
    }, { status: 201 });
    
  } catch (error) {
    console.error('Create admin invite error:', error);
    return NextResponse.json({ 
      error: "Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut." 
    }, { status: 500 });
  }
} 