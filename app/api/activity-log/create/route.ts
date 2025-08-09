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
      objectId = new mongoose.Types.ObjectId(String(userId));
    } catch (e) {
      return NextResponse.json({ error: 'Ungültige Benutzer-ID' }, { status: 401 });
    }
    const currentUser = await usersCollection.findOne({ _id: objectId });
    if (!currentUser) {
      return NextResponse.json({ error: 'Benutzer nicht gefunden' }, { status: 404 });
    }

    // Request-Body parsen
    const csrf = req.headers.get('x-csrf-intent');
    if (process.env.NODE_ENV === 'production' && csrf !== 'activity:create') {
      return NextResponse.json({ error: 'Ungültige Anforderung' }, { status: 400 });
    }
    const schema = z.object({
      actionType: z.string().min(1),
      module: z.string().min(1),
      details: z.object({ description: z.string().min(1) }).passthrough()
    });
    const parseResult = schema.safeParse(await req.json());
    if (!parseResult.success) {
      return NextResponse.json({ error: 'Validierungsfehler', issues: parseResult.error.flatten() }, { status: 400 });
    }
    const { actionType, module, details } = parseResult.data;

    // Validierung
    if (!actionType || !module || !details || !details.description) {
      return NextResponse.json({ error: "Ungültige Daten" }, { status: 400 });
    }

    // Activity Log erstellen
    const activityLog = new ActivityLog({
      timestamp: new Date(),
      actionType,
      module,
      performedBy: {
        userId: currentUser._id,
        name: currentUser.name,
        role: currentUser.role
      },
      details
    });

    await activityLog.save();

    console.log(`Activity logged: ${actionType} - ${details.description}`);

    return NextResponse.json({ 
      success: true,
      message: "Activity Log erstellt"
    });

  } catch (error) {
    console.error('Error creating activity log:', error);
    return NextResponse.json({ 
      error: "Fehler beim Erstellen des Activity Logs" 
    }, { status: 500 });
  }
} 