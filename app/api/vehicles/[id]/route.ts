import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '../../../../lib/dbConnect';
import { Vehicle } from '../../../../lib/models/Vehicle';
import ActivityLog from '../../../../lib/models/ActivityLog';
import { getCurrentUser } from '../../../../lib/auth/getCurrentUser';
import mongoose from 'mongoose';
import { requireAuth } from '../../../../lib/security/requireAuth';
import { z } from 'zod';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const { id } = await params;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: 'Ungültige Fahrzeug-ID' },
        { status: 400 }
      );
    }

    const vehicle = await Vehicle.findById(id);
    if (!vehicle) {
      return NextResponse.json(
        { error: 'Fahrzeug nicht gefunden' },
        { status: 404 }
      );
    }

    return NextResponse.json(vehicle);
  } catch (error) {
    console.error('Fehler beim Laden des Fahrzeugs:', error);
    return NextResponse.json(
      { error: 'Fehler beim Laden des Fahrzeugs' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const { id } = await params;
    const csrf = request.headers.get('x-csrf-intent');
    if (process.env.NODE_ENV === 'production' && csrf !== 'vehicles:update') {
      return NextResponse.json({ error: 'Ungültige Anforderung' }, { status: 400 });
    }
    const auth = await requireAuth(request, ['user','admin','superadmin']);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const schema = z.object({
      type: z.string().min(1).optional(),
      licensePlate: z.string().min(1).optional(),
      fuelAmount: z.string().optional().or(z.literal('')),
      damages: z.string().optional().or(z.literal('')),
      kilometers: z.string().optional().or(z.literal('')),
      manualStatus: z.enum(['verfügbar','wartung','nicht_verfügbar']).optional(),
      statusNote: z.string().optional().or(z.literal('')),
    }).passthrough();
    const parseResult = schema.safeParse(await request.json());
    if (!parseResult.success) {
      return NextResponse.json({ error: 'Validierungsfehler', issues: parseResult.error.flatten() }, { status: 400 });
    }
    const body = parseResult.data;

    const currentUser = await getCurrentUser(request);

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: 'Ungültige Fahrzeug-ID' },
        { status: 400 }
      );
    }

    // Lade den ursprünglichen Fahrzeug für Activity Log
    const originalVehicle = await Vehicle.findById(id);
    if (!originalVehicle) {
      return NextResponse.json(
        { error: 'Fahrzeug nicht gefunden' },
        { status: 404 }
      );
    }

    const vehicle = await Vehicle.findByIdAndUpdate(id, body, {
      new: true,
      runValidators: true
    });

    if (!vehicle) {
      return NextResponse.json(
        { error: 'Fahrzeug nicht gefunden' },
        { status: 404 }
      );
    }

    // Activity Log erstellen
    if (currentUser) {
      try {
        const activityLog = new ActivityLog({
          timestamp: new Date(),
          actionType: 'vehicle_updated',
          module: 'vehicle',
          performedBy: {
            userId: currentUser._id,
            name: currentUser.name,
            role: currentUser.role
          },
            details: {
              entityId: id,
              description: `Fahrzeug bearbeitet: ${originalVehicle.type} (${originalVehicle.licensePlate}) → ${vehicle.type} (${vehicle.licensePlate})`,
              before: {
                type: originalVehicle.type,
                licensePlate: originalVehicle.licensePlate,
                kilometers: originalVehicle.kilometers,
                manualStatus: originalVehicle.manualStatus
              },
              after: {
                type: vehicle.type,
                licensePlate: vehicle.licensePlate,
                kilometers: vehicle.kilometers,
                manualStatus: vehicle.manualStatus
              }
            }
        });
        
        await activityLog.save();
        console.log('Activity Log erstellt für Fahrzeug-Update');
      } catch (logError) {
        console.error('Fehler beim Erstellen des Activity Logs:', logError);
        // Activity Log Fehler sollte nicht die Hauptfunktion beeinträchtigen
      }
    }

    return NextResponse.json(vehicle);
  } catch (error) {
    console.error('Fehler beim Aktualisieren des Fahrzeugs:', error);
    return NextResponse.json(
      { error: 'Fehler beim Aktualisieren des Fahrzeugs' },
      { status: 400 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const { id } = await params;
    const csrf = request.headers.get('x-csrf-intent');
    if (process.env.NODE_ENV === 'production' && csrf !== 'vehicles:delete') {
      return NextResponse.json({ success: false, message: 'Ungültige Anforderung' }, { status: 400 });
    }
    const auth = await requireAuth(request, ['admin','superadmin']);
    if (!auth.ok) return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    
    const currentUser = await getCurrentUser(request);
    
    // Lade den Fahrzeug vor dem Löschen für Activity Log
    const vehicle = await Vehicle.findById(id);
    
    if (!vehicle) {
      return NextResponse.json(
        { 
          success: false,
          message: 'Fahrzeug nicht gefunden' 
        },
        { status: 404 }
      );
    }

    // Activity Log erstellen
    if (currentUser) {
      try {
        const activityLog = new ActivityLog({
          timestamp: new Date(),
          actionType: 'vehicle_deleted',
          module: 'vehicle',
          performedBy: {
            userId: currentUser._id,
            name: currentUser.name,
            role: currentUser.role
          },
          details: {
            entityId: id,
            description: `Fahrzeug "${vehicle.name}" gelöscht`,
            before: {
              name: vehicle.name,
              type: vehicle.type,
              kennzeichen: vehicle.kennzeichen
            }
          }
        });
        
        await activityLog.save();
        console.log('Activity Log erstellt für Fahrzeug-Löschung');
      } catch (logError) {
        console.error('Fehler beim Erstellen des Activity Logs:', logError);
        // Activity Log Fehler sollte nicht die Hauptfunktion beeinträchtigen
      }
    }

    // Fahrzeug löschen
    await Vehicle.findByIdAndDelete(id);

    return NextResponse.json({ 
      success: true,
      message: 'Fahrzeug erfolgreich gelöscht' 
    });
  } catch (error) {
    console.error('Fehler beim Löschen des Fahrzeugs:', error);
    return NextResponse.json(
      { 
        success: false,
        message: 'Fehler beim Löschen des Fahrzeugs' 
      },
      { status: 500 }
    );
  }
} 