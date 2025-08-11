import { NextRequest, NextResponse } from "next/server"
import dbConnect from "../../../../lib/dbConnect"
import User from "../../../../lib/models/User"
import crypto from "crypto"

export async function POST(req: NextRequest) {
  let email = "";
  
  try {
    const body = await req.json();
    email = body.email || "";
  } catch (e) {
    return NextResponse.json({ error: "Ungültige Anfrage (kein JSON-Body)" }, { status: 400 });
  }

  if (!email) {
    return NextResponse.json({ error: "E-Mail-Adresse erforderlich" }, { status: 400 });
  }

  try {
    await dbConnect();
    
    // Prüfen ob Benutzer existiert
    const user = await User.findOne({ email });
    if (!user) {
      // Aus Sicherheitsgründen geben wir keine Information darüber, ob die E-Mail existiert
      return NextResponse.json({ 
        message: "Falls ein Konto mit dieser E-Mail-Adresse existiert, wurde eine E-Mail mit Anweisungen zum Zurücksetzen des Passworts gesendet." 
      }, { status: 200 });
    }

    // Reset-Token generieren
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 Stunde gültig

    // Token in der Datenbank speichern
    user.resetToken = resetToken;
    user.resetTokenExpiry = resetTokenExpiry;
    await user.save();

    // In einer echten App würden wir hier eine E-Mail senden
    // Für Demo-Zwecke geben wir eine Erfolgsmeldung zurück
    console.log(`Reset-Token für ${email}: ${resetToken}`);
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
    console.log(`Reset-Link: ${baseUrl}/reset-password?token=${resetToken}`);

    return NextResponse.json({ 
      message: "Falls ein Konto mit dieser E-Mail-Adresse existiert, wurde eine E-Mail mit Anweisungen zum Zurücksetzen des Passworts gesendet." 
    }, { status: 200 });
    
  } catch (error) {
    console.error('Forgot password error:', error);
    return NextResponse.json({ 
      error: "Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut." 
    }, { status: 500 });
  }
} 