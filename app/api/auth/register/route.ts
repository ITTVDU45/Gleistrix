import { NextRequest, NextResponse } from "next/server"
import dbConnect from "../../../../lib/dbConnect"
import User from "../../../../lib/models/User"
import { hash } from "bcryptjs"

export async function POST(req: NextRequest) {
  let email = "";
  let password = "";
  let name = "";
  
  try {
    const body = await req.json();
    email = body.email || "";
    password = body.password || "";
    name = body.name || "";
  } catch (e) {
    return NextResponse.json({ error: "Ungültige Anfrage (kein JSON-Body)" }, { status: 400 });
  }

  if (!email || !password || !name) {
    return NextResponse.json({ error: "E-Mail, Passwort und Name erforderlich" }, { status: 400 });
  }

  if (password.length < 6) {
    return NextResponse.json({ error: "Passwort muss mindestens 6 Zeichen lang sein" }, { status: 400 });
  }

  await dbConnect();
  
  // Prüfen ob Benutzer bereits existiert
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return NextResponse.json({ error: "Ein Benutzer mit dieser E-Mail existiert bereits" }, { status: 409 });
  }

  // Passwort hashen
  const hashedPassword = await hash(password, 12);

  // Neuen Benutzer erstellen
  const user = new User({
    email,
    password: hashedPassword,
    name,
    createdAt: new Date(),
    updatedAt: new Date()
  });

  await user.save();

  return NextResponse.json({ 
    message: "Benutzer erfolgreich erstellt",
    user: { email: user.email, name: user.name }
  }, { status: 201 });
} 