import { NextRequest, NextResponse } from "next/server"
import dbConnect from "@/lib/dbConnect"
import User from "@/lib/models/User"
import SuperadminProfile from "@/lib/models/SuperadminProfile"
import { getCurrentUser } from "../../../../lib/auth/getCurrentUser"
import { ENV_SUPERADMIN_JWT_ID } from "../../../../lib/auth/envSuperadmin"
import { logger } from "@/lib/logger"
import { z } from 'zod'

export async function PUT(req: NextRequest) {
  try {
    await dbConnect();

    const current = await getCurrentUser(req);
    if (!current) {
      return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
    }

    // Request-Body parsen (CSRF zuerst)
    const csrf = req.headers.get('x-csrf-intent');
    if (process.env.NODE_ENV === 'production' && csrf !== 'auth:update-profile') {
      return NextResponse.json({ error: 'Ungültige Anforderung' }, { status: 400 });
    }
    const schema = z.object({
      name: z.string().min(1),
      // E-Mail ist read-only – wird angenommen, aber nicht verändert
      email: z.string().email().optional(),
      phone: z.string().optional().or(z.literal('')),
    });
    const parseResult = schema.safeParse(await req.json());
    if (!parseResult.success) {
      return NextResponse.json({ error: 'Validierungsfehler', issues: parseResult.error.flatten() }, { status: 400 });
    }
    const { name, phone } = parseResult.data;

    // ENV-Superadmin besitzt kein users-Dokument → Name/Telefon in eigenem
    // Profil-Speicher ablegen (E-Mail bleibt über SUPERADMIN_EMAIL fixiert).
    if (String(current._id) === ENV_SUPERADMIN_JWT_ID) {
      const doc = await SuperadminProfile.findOneAndUpdate(
        { scope: 'env-superadmin' },
        { $set: { name: name.trim(), phone: phone ?? '' }, $setOnInsert: { scope: 'env-superadmin' } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      ).lean() as { name?: string; phone?: string } | null;

      logger.info('ENV-Superadmin-Profil aktualisiert');
      return NextResponse.json({
        message: "Profil erfolgreich aktualisiert",
        user: {
          id: ENV_SUPERADMIN_JWT_ID,
          name: doc?.name || name.trim(),
          email: current.email || '',
          phone: doc?.phone ?? phone ?? '',
          role: 'superadmin',
        },
      }, { status: 200 });
    }

    // Benutzer in Datenbank finden
    const user = await User.findById(current._id);
    if (!user) {
      return NextResponse.json({ error: "Benutzer nicht gefunden" }, { status: 404 });
    }

    const email = user.email; // E-Mail read-only: bestehende Adresse beibehalten

    // Validierung
    if (!name || !email) {
      return NextResponse.json({ error: "Name und E-Mail sind erforderlich" }, { status: 400 });
    }

    // E-Mail-Format validieren
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "Ungültige E-Mail-Adresse" }, { status: 400 });
    }

    // Prüfen ob E-Mail bereits von einem anderen Benutzer verwendet wird
    const existingUser = await User.findOne({ email, _id: { $ne: user._id } });
    if (existingUser) {
      return NextResponse.json({ error: "Diese E-Mail-Adresse wird bereits verwendet" }, { status: 409 });
    }

    // Profildaten aktualisieren
    user.name = name;
    user.email = email;
    
    // Telefonnummer explizit setzen (auch wenn leer)
    if (phone !== undefined) {
      user.phone = phone;
    }

    // Änderungen speichern
    await user.save();

    // Aktualisierten Benutzer aus der Datenbank laden
    const updatedUser = await User.findById(user._id);

    logger.info('Profil aktualisiert', { userId: String(updatedUser._id), role: updatedUser.role });

    return NextResponse.json({
      message: "Profil erfolgreich aktualisiert",
      user: {
        id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        phone: updatedUser.phone,
        role: updatedUser.role
      }
    }, { status: 200 });
    
  } catch (error) {
    logger.error('Update profile error', error);
    return NextResponse.json({ 
      error: "Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut." 
    }, { status: 500 });
  }
} 