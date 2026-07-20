import { NextRequest, NextResponse } from "next/server"
import dbConnect from "@/lib/dbConnect"
import InviteToken from "@/lib/models/InviteToken"
import User from "@/lib/models/User"
import { hashInviteToken } from "@/lib/subunternehmen/inviteToken"
import { acceptSubcontractorInvite } from "@/lib/subunternehmen/acceptInvite"
import { hash } from "bcryptjs"
import { logger } from "@/lib/logger"

export async function POST(req: NextRequest) {
  try {
    await dbConnect();

    const body = await req.json();
    const { token, password } = body;

    if (!token) {
      return NextResponse.json({ error: "Token ist erforderlich" }, { status: 400 });
    }

    // Subunternehmen-Einladung? (Lookup ausschließlich über Hash)
    const subcontractorInvite = await InviteToken.findOne({
      tokenHash: hashInviteToken(String(token)),
      invitationType: 'SUBCONTRACTOR',
    });
    if (subcontractorInvite) {
      return acceptSubcontractorInvite(subcontractorInvite, password);
    }

    if (!password) {
      return NextResponse.json({ error: "Token und Passwort sind erforderlich" }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: "Passwort muss mindestens 6 Zeichen lang sein" }, { status: 400 });
    }

    // Alt-Flow (interne Einladungen, Klartext-Token). SUBCONTRACTOR ist hier
    // ausgeschlossen, damit ein geleakter Hash nicht einlösbar ist.
    const inviteToken = await InviteToken.findOne({
      token,
      invitationType: { $ne: 'SUBCONTRACTOR' },
    });

    if (!inviteToken) {
      return NextResponse.json({ error: "Ungültiger oder abgelaufener Token" }, { status: 400 });
    }

    if (inviteToken.used) {
      return NextResponse.json({ error: "Token wurde bereits verwendet" }, { status: 400 });
    }

    if (inviteToken.expiresAt < new Date()) {
      return NextResponse.json({ error: "Token ist abgelaufen" }, { status: 400 });
    }

    // Prüfen ob Benutzer bereits existiert
    const existingUser = await User.findOne({ email: inviteToken.email });
    if (existingUser) {
      return NextResponse.json({ error: "Ein Benutzer mit dieser E-Mail existiert bereits" }, { status: 409 });
    }

    // Passwort hashen
    const hashedPassword = await hash(password, 12);

    // Vollständigen Namen erstellen
    const fullName = inviteToken.name || `${inviteToken.firstName || ''} ${inviteToken.lastName || ''}`.trim();

    // Neuen Benutzer erstellen
    const newUser = new User({
      email: inviteToken.email,
      name: fullName,
      password: hashedPassword,
      role: inviteToken.role,
      firstName: inviteToken.firstName,
      lastName: inviteToken.lastName,
      phone: inviteToken.phone,
      isActive: true,
      ...(inviteToken.createdBy ? { createdBy: inviteToken.createdBy } : {}),
      modules: inviteToken.modules ?? [],
    });

    await newUser.save();

    // Token als verwendet markieren
    inviteToken.used = true;
    await inviteToken.save();

    return NextResponse.json({
      message: "Benutzer erfolgreich erstellt",
      user: {
        email: newUser.email,
        name: newUser.name,
        role: newUser.role
      }
    }, { status: 201 });

  } catch (error) {
    logger.error('Set password error', error);
    return NextResponse.json({
      error: "Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut."
    }, { status: 500 });
  }
}
