import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '../../../../lib/dbConnect';
import ActivityLog from '../../../../lib/models/ActivityLog';
import mongoose from 'mongoose';
import { getToken } from 'next-auth/jwt';
import { z } from 'zod';

export async function POST(req: NextRequest) {
  try {
    await dbConnect();
    
    // NextAuth-Token lesen
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token) {
      return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 });
    }
    
    // Benutzer aus der users-Collection laden (mit Guard gegen undefined)
    const db = mongoose.connection.db;
    if (!db) {
      return NextResponse.json({ error: 'Datenbankverbindung nicht verfügbar' }, { status: 500 });
    }
    const usersCollection = db.collection('users');
    const userId = token.id as string | undefined;
    if (!userId) {
      return NextResponse.json({ error: 'Ungültiges Token' }, { status: 401 });
    }
    let objectId;
    try {
      objectId = new mongoose.Types.ObjectId(userId);
    } catch (e) {
      return NextResponse.json({ error: 'Ungültige Benutzer-ID' }, { status: 401 });
    }
    const currentUser = await usersCollection.findOne({ _id: objectId });
    if (!currentUser) {
      return NextResponse.json({ error: 'Benutzer nicht gefunden' }, { status: 404 });
    }

    // Request-Body parsen
    const csrf = req.headers.get('x-csrf-intent');
    if (process.env.NODE_ENV === 'production' && csrf !== 'activity:pdf-export') {
      return NextResponse.json({ error: 'Ungültige Anforderung' }, { status: 400 });
    }
    const schema = z.object({
      module: z.string().min(1),
      entityId: z.string().optional(),
      entityName: z.string().optional(),
      exportType: z.string().min(1),
      details: z.record(z.any()).optional()
    });
    const parseResult = schema.safeParse(await req.json());
    if (!parseResult.success) {
      return NextResponse.json({ error: 'Validierungsfehler', issues: parseResult.error.flatten() }, { status: 400 });
    }
    const { module, entityId, entityName, exportType, details } = parseResult.data;

    // Validierung
    if (!module || !exportType) {
      return NextResponse.json({ error: "Ungültige Daten" }, { status: 400 });
    }

    // Activity Log erstellen
    const activityLog = new ActivityLog({
      timestamp: new Date(),
      actionType: `${module}_export_pdf`,
      module,
      performedBy: {
        userId: currentUser._id,
        name: currentUser.name,
        role: currentUser.role
      },
      details: {
        entityId,
        description: `PDF Export für ${module === 'project' ? 'Projekt' : module === 'employee' ? 'Mitarbeiter' : module === 'vehicle' ? 'Fahrzeug' : module}${entityName ? ` "${entityName}"` : ''} erstellt`,
        context: {
          exportType,
          entityName,
          ...details
        }
      }
    });

    await activityLog.save();

    console.log(`PDF Export logged: ${module} - ${entityName || 'Übersicht'}`);

    return NextResponse.json({ 
      success: true,
      message: "PDF Export Activity Log erstellt"
    });

  } catch (error) {
    console.error('Error creating PDF export activity log:', error);
    return NextResponse.json({ 
      error: "Fehler beim Erstellen des PDF Export Activity Logs" 
    }, { status: 500 });
  }
} 