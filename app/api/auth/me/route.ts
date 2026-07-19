import { NextRequest, NextResponse } from "next/server"
import dbConnect from "../../../../lib/dbConnect"
import mongoose from "mongoose"
import { getToken } from "next-auth/jwt"
import { ENV_SUPERADMIN_JWT_ID, isEnvSuperadminJwtToken } from "../../../../lib/auth/envSuperadmin"
import { logger } from "../../../../lib/logger"

export async function GET(req: NextRequest) {
  try {
    // NextAuth Token aus Request lesen
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    
    if (!token) {
      return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
    }

    await dbConnect();
    
    // Benutzer direkt aus der Collection abrufen
    const db = mongoose.connection.db;
    if (!db) {
      return NextResponse.json({ error: 'Datenbankverbindung nicht verfügbar' }, { status: 500 });
    }
    const usersCollection = db.collection('users');
    const userId = token.id as string | undefined;

    if (!userId) {
      return NextResponse.json({ error: "Ungültiges Token" }, { status: 401 });
    }

    if (isEnvSuperadminJwtToken(token as { id?: string; role?: string })) {
      return NextResponse.json({
        user: {
          id: ENV_SUPERADMIN_JWT_ID,
          email: (token as { email?: string }).email ?? "",
          name: (token as { name?: string }).name || "Super Admin",
          role: "superadmin",
          firstName: "",
          lastName: "",
          phone: "",
          address: undefined,
          lastLogin: undefined,
          modules: [],
        },
      }, { status: 200 });
    }
    
    let objectId: mongoose.Types.ObjectId;
    try {
      objectId = new mongoose.Types.ObjectId(String(userId));
    } catch (error) {
      logger.warn("Ungültige Benutzer-ID im Token", error);
      return NextResponse.json({ error: "Ungültige Benutzer-ID" }, { status: 401 });
    }
    
    const user = await usersCollection.findOne({ _id: objectId });
    
    if (!user) {
      logger.debug("Benutzer nicht gefunden", { userId });
      return NextResponse.json({ error: "Benutzer nicht gefunden" }, { status: 401 });
    }

    // Prüfen ob Account aktiv ist
    if (user.isActive === false) {
      return NextResponse.json({ error: "Account ist deaktiviert" }, { status: 401 });
    }

    return NextResponse.json({
      user: { 
        id: user._id.toString(),
        email: user.email, 
        name: user.name || '',
        role: user.role || 'user',
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        address: user.address,
        lastLogin: user.lastLogin,
        modules: user.modules ?? [],
      } 
    }, { status: 200 });
    
  } catch (error) {
    logger.error('Auth verification error', error);
    return NextResponse.json({ error: "Ein Fehler ist aufgetreten" }, { status: 500 });
  }
} 