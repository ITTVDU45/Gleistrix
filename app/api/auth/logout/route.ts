import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  try {
    const response = NextResponse.json({ 
      message: "Erfolgreich abgemeldet" 
    }, { status: 200 });

    // Auth-Cookie löschen
    response.cookies.set('auth-token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0, // Sofort ablaufen
      expires: new Date(0) // Sofort ablaufen
    });

    console.log('=== LOGOUT ERFOLGREICH ===');
    console.log(`Zeit: ${new Date().toLocaleString('de-DE')}`);
    console.log('==========================');

    return response;
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json({ 
      error: "Ein Fehler ist aufgetreten" 
    }, { status: 500 });
  }
} 