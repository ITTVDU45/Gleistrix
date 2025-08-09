import { NextRequest, NextResponse } from "next/server"
import dbConnect from "../../../../lib/dbConnect"
import InviteToken from "../../../../lib/models/InviteToken"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.json({ error: "Token erforderlich" }, { status: 400 });
  }

  try {
    await dbConnect();
    
    // Token in der Datenbank suchen
    const inviteToken = await InviteToken.findOne({ 
      token,
      used: false,
      expiresAt: { $gt: new Date() }
    });

    if (!inviteToken) {
      return NextResponse.json({ 
        error: "Ungültiger oder abgelaufener Token" 
      }, { status: 400 });
    }

    return NextResponse.json({ 
      valid: true,
      email: inviteToken.email,
      name: inviteToken.name,
      role: inviteToken.role,
      expiresAt: inviteToken.expiresAt
    }, { status: 200 });
    
  } catch (error) {
    console.error('Validate token error:', error);
    return NextResponse.json({ 
      error: "Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut." 
    }, { status: 500 });
  }
} 