import { NextRequest, NextResponse } from "next/server"
import dbConnect from "../../../../lib/dbConnect"
import InviteToken from "../../../../lib/models/InviteToken"
import User from "../../../../lib/models/User"
import { nanoid } from "nanoid"
import { sendInviteEmailResult } from "../../../../lib/mailer"
import { requireAdminUser } from "../../../../lib/auth/requireAdminUser"
import { resolveInviteCreatorId } from "../../../../lib/auth/resolveInviteCreatorId"
import { z } from 'zod'

export async function POST(req: NextRequest) {
  try {
    const adminAuth = await requireAdminUser(req)
    if (!adminAuth.ok) {
      return NextResponse.json(
        { error: adminAuth.status === 403 ? "Nur Superadmins und Admins können Admins einladen" : adminAuth.error },
        { status: adminAuth.status }
      )
    }

    await dbConnect()

    const createdBy = await resolveInviteCreatorId(adminAuth.user.id)
    if (!createdBy) {
      return NextResponse.json(
        {
          error:
            "Für den Superadmin konnte kein Admin-Benutzer in der Datenbank als Ersteller der Einladung zugeordnet werden. Bitte legen Sie mindestens einen Admin in der Datenbank an.",
        },
        { status: 500 }
      )
    }

    const csrf = req.headers.get('x-csrf-intent');
    if (process.env.NODE_ENV === 'production' && csrf !== 'invite:create-admin') {
      return NextResponse.json({ error: 'Ungültige Anforderung' }, { status: 400 });
    }
    const schema = z.object({
      firstName: z.string().min(1),
      lastName: z.string().min(1),
      email: z.string().email(),
      phone: z.string().optional().or(z.literal('')),
      resend: z.boolean().optional().default(false),
      modules: z.array(z.string()).optional(),
    });
    const parseResult = schema.safeParse(await req.json());
    if (!parseResult.success) {
      return NextResponse.json({ error: 'Validierungsfehler', issues: parseResult.error.flatten() }, { status: 400 });
    }
    const { firstName, lastName, email, phone, resend, modules } = parseResult.data;

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

    if (resend) {
      await InviteToken.deleteMany({ email });
    } else {
      const existingInvite = await InviteToken.findOne({
        email,
        used: false,
        expiresAt: { $gt: new Date() }
      });
      if (existingInvite) {
        return NextResponse.json({
          error: "Eine gültige Einladung für diese E-Mail wurde bereits gesendet",
          message: "Die Einladung ist noch 24 Stunden gültig. Bitte warten Sie, bis sie abgelaufen ist."
        }, { status: 409 });
      }
      await InviteToken.deleteMany({
        email,
        $or: [
          { used: true },
          { expiresAt: { $lt: new Date() } }
        ]
      });
    }

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
      createdBy,
      name: `${firstName} ${lastName}`,
      firstName,
      lastName,
      phone,
      modules: modules ?? [],
    });

    await inviteToken.save();

    // E-Mail-Einladung senden
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
    const inviteLink = `${baseUrl}/auth/set-password?token=${token}`;
    const emailResult = await sendInviteEmailResult(email, `${firstName} ${lastName}`, 'admin', inviteLink, expiresAt);

    if (emailResult.ok) {
      console.log('=== ADMIN EINLADUNG GESENDET ===');
      console.log(`An: ${email}`);
      console.log(`Name: ${firstName} ${lastName}`);
      console.log('==================================');
    } else {
      console.warn('=== E-MAIL VERSAND FEHLGESCHLAGEN ===', emailResult.error);
      console.log(`An: ${email}`);
      console.log(`Token/Link für manuellen Versand: ${inviteLink}`);
      console.log('=====================================');
    }

    return NextResponse.json({
      message: emailResult.ok
        ? "Admin-Einladung erfolgreich gesendet"
        : "Einladung angelegt, E-Mail konnte nicht zugestellt werden.",
      emailSent: emailResult.ok,
      emailError: emailResult.error,
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