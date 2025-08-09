import { NextRequest, NextResponse } from "next/server"
import dbConnect from "../../../../lib/dbConnect"
import User from "../../../../lib/models/User"
import { getCurrentUser } from "../../../../lib/auth/getCurrentUser"
import { z } from 'zod'

export async function PUT(req: NextRequest) {
  try {
    await dbConnect();
    
    const current = await getCurrentUser(req);
    if (!current) {
      return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
    }
    // Benutzer in Datenbank finden
    const user = await User.findById(current._id);
    
    if (!user) {
      return NextResponse.json({ error: "Benutzer nicht gefunden" }, { status: 404 });
    }

    // Request-Body parsen
    const csrf = req.headers.get('x-csrf-intent');
    if (process.env.NODE_ENV === 'production' && csrf !== 'auth:update-profile') {
      return NextResponse.json({ error: 'Ungültige Anforderung' }, { status: 400 });
    }
    const schema = z.object({
      name: z.string().min(1),
      email: z.string().email(),
      phone: z.string().optional().or(z.literal('')),
    });
    const parseResult = schema.safeParse(await req.json());
    if (!parseResult.success) {
      return NextResponse.json({ error: 'Validierungsfehler', issues: parseResult.error.flatten() }, { status: 400 });
    }
    const { name, email, phone } = parseResult.data;

    console.log('=== PROFIL UPDATE REQUEST ===');
    console.log('Empfangene Daten:', { name, email, phone });
    console.log('Aktuelle Benutzerdaten:', {
      name: user.name,
      email: user.email,
      phone: user.phone
    });

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
      console.log('Telefonnummer wird gesetzt auf:', phone);
    }

    // Änderungen speichern
    await user.save();

    // Aktualisierten Benutzer aus der Datenbank laden
    const updatedUser = await User.findById(user._id);

    console.log('=== PROFIL AKTUALISIERT ===');
    console.log(`Benutzer: ${updatedUser.name} (${updatedUser.email})`);
    console.log(`Telefon: ${updatedUser.phone || 'Nicht angegeben'}`);
    console.log(`Zeit: ${new Date().toLocaleString('de-DE')}`);
    console.log('==========================');

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
    console.error('Update profile error:', error);
    return NextResponse.json({ 
      error: "Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut." 
    }, { status: 500 });
  }
} 