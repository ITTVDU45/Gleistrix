import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from "next/server"
import dbConnect from "@/lib/dbConnect"
import User from "@/lib/models/User"
import { getCurrentUser } from "../../../../../lib/auth/getCurrentUser"
import { z } from 'zod'

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    
    const currentUser = await getCurrentUser(req);
    if (!currentUser) {
      return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
    }
    // Prüfen ob eingeloggter Benutzer Superadmin ist
    if (!currentUser || currentUser.role !== 'superadmin') {
      return NextResponse.json({ error: "Nur Superadmins können Rollen ändern" }, { status: 403 });
    }

    // Benutzer finden
    const { id } = await params;
    const user = await User.findById(id);
    if (!user) {
      return NextResponse.json({ error: "Benutzer nicht gefunden" }, { status: 404 });
    }

    // Request-Body parsen + validieren + CSRF
    const csrf = req.headers.get('x-csrf-intent')
    if (process.env.NODE_ENV === 'production' && csrf !== 'users:update-role') {
      return NextResponse.json({ error: 'Ungültige Anforderung' }, { status: 400 })
    }
    const schema = z.object({ role: z.enum(['superadmin', 'admin', 'user', 'lager']) })
    const parseResult = schema.safeParse(await req.json())
    if (!parseResult.success) {
      return NextResponse.json({ error: 'Validierungsfehler', issues: parseResult.error.flatten() }, { status: 400 })
    }
    const { role } = parseResult.data

    // Rolle aktualisieren
    user.role = role;
    await user.save();

    logger.debug('=== BENUTZER-ROLLE GEÄNDERT ===');
    logger.debug(`Benutzer: ${user.name} (${user.email})`);
    logger.debug(`Neue Rolle: ${role}`);
    logger.debug(`Geändert von: ${currentUser.name} (${currentUser.role})`);
    logger.debug('================================');

    return NextResponse.json({ 
      message: `Rolle erfolgreich zu ${role} geändert`,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    }, { status: 200 });
    
  } catch (error) {
    logger.error('Update role error:', error);
    return NextResponse.json({ 
      error: "Ein Fehler ist aufgetreten" 
    }, { status: 500 });
  }
} 