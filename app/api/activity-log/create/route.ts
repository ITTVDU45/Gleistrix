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
      actionType: z.enum([
        'project_created','project_updated','project_deleted','project_status_changed','project_billed',
        'billing_partial','billing_full',
        'project_technology_added','project_technology_updated','project_technology_removed',
        'project_time_entry_added','project_time_entry_updated','project_time_entry_deleted',
        'project_vehicle_assigned','project_vehicle_updated','project_vehicle_unassigned',
        'project_export_pdf','project_export_csv',
        'employee_created','employee_updated','employee_deleted','employee_status_changed',
        'employee_vacation_added','employee_vacation_deleted','employee_export_pdf',
        'vehicle_created','vehicle_updated','vehicle_deleted','vehicle_export_pdf',
        'time_tracking_export_pdf','time_tracking_export_csv',
        'settings_updated','user_created','user_invited','user_status_changed','user_role_changed','user_deleted',
        'login','logout','password_changed','profile_updated'
      ] as const),
      module: z.enum(['project','employee','vehicle','time_tracking','settings','system','billing'] as const),
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