import { NextRequest, NextResponse } from "next/server"
import dbConnect from "../../../../lib/dbConnect"
import User from "../../../../lib/models/User"
import { hash } from "bcryptjs"
import { sendWelcomeEmail } from "../../../../lib/mailer"

export async function POST(req: NextRequest) {
  let firstName = "";
  let lastName = "";
  let email = "";
  let phone = "";
  let address = "";
  let password = "";
  
  try {
    const body = await req.json();
    firstName = body.firstName || "";
    lastName = body.lastName || "";
    email = body.email || "";
    phone = body.phone || "";
    address = body.address || "";
    password = body.password || "";
  } catch (e) {
    return NextResponse.json({ error: "Ungültige Anfrage (kein JSON-Body)" }, { status: 400 });
  }

  if (!firstName || !lastName || !email || !phone || !address || !password) {
    return NextResponse.json({ error: "Alle Felder sind erforderlich" }, { status: 400 });
  }

  if (password.length < 6) {
    return NextResponse.json({ error: "Passwort muss mindestens 6 Zeichen lang sein" }, { status: 400 });
  }

  try {
    await dbConnect();
    
    // Prüfen ob bereits ein Superadmin existiert
    const existingSuperadmin = await User.findOne({ role: 'superadmin' });
    if (existingSuperadmin) {
      return NextResponse.json({ error: "Superadmin existiert bereits" }, { status: 409 });
    }

    // Prüfen ob E-Mail bereits verwendet wird
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return NextResponse.json({ error: "Ein Benutzer mit dieser E-Mail existiert bereits" }, { status: 409 });
    }

    // Passwort hashen
    const hashedPassword = await hash(password, 12);

    // Vollständigen Namen erstellen
    const fullName = `${firstName} ${lastName}`;

    // Superadmin erstellen
    const superadmin = new User({
      email,
      name: fullName,
      password: hashedPassword,
      role: 'superadmin',
      // Zusätzliche Felder für erweiterte Informationen
      firstName,
      lastName,
      phone,
      address,
      isActive: true
    });

    await superadmin.save();

    // E-Mail an Superadmin senden
    let emailSent = false;
    try {
      emailSent = await sendWelcomeEmail(email, fullName);
    } catch (emailError) {
      console.error('E-Mail-Versand fehlgeschlagen:', emailError);
      // E-Mail-Fehler sollte nicht den gesamten Prozess stoppen
    }

    // Markieren dass E-Mail gesendet wurde (auch wenn fehlgeschlagen)
    superadmin.welcomeEmailSent = emailSent;
    superadmin.welcomeEmailSentAt = emailSent ? new Date() : null;
    await superadmin.save();

    // Demo-Logging
    console.log('=== SUPERADMIN ERSTELLT ===');
    console.log(`Name: ${fullName}`);
    console.log(`E-Mail: ${email}`);
    console.log(`Telefon: ${phone}`);
    console.log(`Adresse: ${address}`);
    console.log(`Rolle: Superadmin`);
    console.log(`E-Mail gesendet: ${emailSent}`);
    console.log('==========================');

    return NextResponse.json({ 
      message: "Superadmin erfolgreich erstellt",
      emailSent: emailSent,
      user: {
        email: superadmin.email,
        name: superadmin.name,
        role: superadmin.role,
        welcomeEmailSent: emailSent,
        welcomeEmailSentAt: superadmin.welcomeEmailSentAt
      }
    }, { status: 201 });
    
  } catch (error) {
    console.error('Create superadmin error:', error);
    return NextResponse.json({ 
      error: "Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut." 
    }, { status: 500 });
  }
} 