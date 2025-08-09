import { NextRequest, NextResponse } from "next/server"
import dbConnect from "../../../../lib/dbConnect"
import User from "../../../../lib/models/User"

export async function GET(req: NextRequest) {
  try {
    await dbConnect();
    
    // Prüfen ob bereits ein Superadmin existiert
    const superadmin = await User.findOne({ role: 'superadmin' });
    
    return NextResponse.json({ 
      available: !superadmin,
      message: superadmin ? 'Setup bereits durchgeführt' : 'Setup verfügbar'
    }, { status: 200 });
    
  } catch (error) {
    console.error('Setup status error:', error);
    return NextResponse.json({ 
      error: "Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut." 
    }, { status: 500 });
  }
} 