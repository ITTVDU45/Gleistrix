import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '../../../lib/dbConnect';
import { Vehicle } from '../../../lib/models/Vehicle';
import ActivityLog from '../../../lib/models/ActivityLog';
import { getCurrentUser } from '../../../lib/auth/getCurrentUser';
import { requireAuth } from '../../../lib/security/requireAuth';
import { z } from 'zod';

export async function GET() {
  try {
    await dbConnect();
    const vehicles = await Vehicle.find({});
    return NextResponse.json({ 
      success: true,
      vehicles: vehicles 
    });
  } catch (error) {
    console.error('Fehler beim Laden der Fahrzeuge:', error);
    return NextResponse.json(
      { 
        success: false,
        message: 'Fehler beim Laden der Fahrzeuge' 
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    const csrf = request.headers.get('x-csrf-intent');
    if (process.env.NODE_ENV === 'production' && csrf !== 'vehicles:create') {
      return NextResponse.json({ success: false, message: 'Ungültige Anforderung' }, { status: 400 });
    }
    const auth = await requireAuth(request, ['user','admin','superadmin']);
    if (!auth.ok) return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });

    const schema = z.object({
      name: z.string().min(1),
      type: z.string().min(1),
      kennzeichen: z.string().min(1),
    }).passthrough();
    const parseResult = schema.safeParse(await request.json());
    if (!parseResult.success) {
      return NextResponse.json({ success: false, message: 'Validierungsfehler', issues: parseResult.error.flatten() }, { status: 400 });
    }
    const body = parseResult.data;
    
    const currentUser = await getCurrentUser(request);
    
    const vehicle = await Vehicle.create(body);
    
    // Activity Log erstellen
    if (currentUser) {
      try {
        const activityLog = new ActivityLog({
          timestamp: new Date(),
          actionType: 'vehicle_created',
          module: 'vehicle',
          performedBy: {
            userId: currentUser._id,
            name: currentUser.name,
            role: currentUser.role
          },
          details: {
            entityId: vehicle._id,
            description: `Fahrzeug "${body.name}" hinzugefügt`,
            after: {
              name: body.name,
              type: body.type,
              kennzeichen: body.kennzeichen
            }
          }
        });
        
        await activityLog.save();
        console.log('Activity Log erstellt für Fahrzeug-Erstellung');
      } catch (logError) {
        console.error('Fehler beim Erstellen des Activity Logs:', logError);
        // Activity Log Fehler sollte nicht die Hauptfunktion beeinträchtigen
      }
    }
    
    return NextResponse.json({ 
      success: true,
      data: vehicle 
    }, { status: 201 });
  } catch (error) {
    console.error('Fehler beim Erstellen des Fahrzeugs:', error);
    return NextResponse.json(
      { 
        success: false,
        message: 'Fehler beim Erstellen des Fahrzeugs' 
      },
      { status: 500 }
    );
  }
} 