import { NextRequest, NextResponse } from "next/server"
import dbConnect from "../../../../lib/dbConnect"
import InviteToken from "../../../../lib/models/InviteToken"
import User from "../../../../lib/models/User"
import { hash } from "bcryptjs"

export async function POST(req: NextRequest) {
  try {
    await dbConnect();
    
    // Request-Body parsen
    const body = await req.json();
    const { token, password } = body;

    if (!token || !password) {
      return NextResponse.json({ error: "Token und Passwort sind erforderlich" }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: "Passwort muss mindestens 6 Zeichen lang sein" }, { status: 400 });
    }

    // Token in Datenbank finden
    const inviteToken = await InviteToken.findOne({ token });
    
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
      isActive: true
    });

    await newUser.save();

    // Token als verwendet markieren
    inviteToken.used = true;
    await inviteToken.save();

    console.log('=== BENUTZER ERSTELLT ===');
    console.log(`E-Mail: ${newUser.email}`);
    console.log(`Name: ${newUser.name}`);
    console.log(`Rolle: ${newUser.role}`);
    console.log(`Telefon: ${newUser.phone || 'Nicht angegeben'}`);
    console.log(`Erstellt von Token: ${token}`);
    console.log('==========================');

    return NextResponse.json({ 
      message: "Benutzer erfolgreich erstellt",
      user: {
        email: newUser.email,
        name: newUser.name,
        role: newUser.role
      }
    }, { status: 201 });
    
  } catch (error) {
    console.error('Set password error:', error);
    return NextResponse.json({ 
      error: "Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut." 
    }, { status: 500 });
  }
} 