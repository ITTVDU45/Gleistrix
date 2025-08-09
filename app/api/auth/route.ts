import { NextRequest, NextResponse } from "next/server"
import dbConnect from "../../../lib/dbConnect"
import User from "../../../lib/models/User"
import { compare } from "bcryptjs"

export async function POST(req: NextRequest) {
  let email = "";
  let password = "";
  
  try {
    const body = await req.json();
    email = body.email || "";
    password = body.password || "";
  } catch (e) {
    return NextResponse.json({ error: "Ungültige Anfrage (kein JSON-Body)" }, { status: 400 });
  }

  if (!email || !password) {
    return NextResponse.json({ error: "E-Mail und Passwort erforderlich" }, { status: 400 });
  }

  try {
    await dbConnect();
    const user = await User.findOne({ email });
    
    if (!user) {
      return NextResponse.json({ error: "E-Mail oder Passwort ist falsch" }, { status: 401 });
    }

    // Prüfen ob Account aktiv ist
    if (!user.isActive) {
      return NextResponse.json({ error: "Account ist deaktiviert" }, { status: 401 });
    }

    const isValid = await compare(password, user.password);
    if (!isValid) {
      return NextResponse.json({ error: "E-Mail oder Passwort ist falsch" }, { status: 401 });
    }

    // LastLogin aktualisieren
    user.lastLogin = new Date();
    await user.save();

    // Session-Cookie setzen (einfache Implementierung)
    const response = NextResponse.json({ 
      message: "Anmeldung erfolgreich",
      user: { 
        id: user._id,
        email: user.email, 
        name: user.name,
        role: user.role
      } 
    }, { status: 200 });

    // Session-Cookie setzen
    response.cookies.set('auth-token', user._id.toString(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7 // 7 Tage
    });

    console.log('=== LOGIN ERFOLGREICH ===');
    console.log(`Benutzer: ${user.name} (${user.email})`);
    console.log(`Rolle: ${user.role}`);
    console.log(`Zeit: ${new Date().toLocaleString('de-DE')}`);
    console.log('========================');

    return response;
    
  } catch (error) {
    console.error('Login-Fehler:', error);
    return NextResponse.json({ error: "Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut." }, { status: 500 });
  }
} 