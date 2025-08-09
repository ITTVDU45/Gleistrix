import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '../../../../../lib/dbConnect';
import { Project } from '../../../../../lib/models/Project';
import ActivityLog from '../../../../../lib/models/ActivityLog';
import { getCurrentUser } from '../../../../../lib/auth/getCurrentUser';
import { requireAuth } from '../../../../../lib/security/requireAuth';
import { z } from 'zod';
import mongoose from 'mongoose';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const { id } = await params;
    const csrf = request.headers.get('x-csrf-intent');
    if (process.env.NODE_ENV === 'production' && csrf !== 'project-vehicle:assign') {
      return NextResponse.json({ error: 'Ungültige Anforderung' }, { status: 400 });
    }
    const auth = await requireAuth(request, ['user','admin','superadmin']);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const schema = z.object({
      date: z.string().min(8),
      vehicle: z.object({
        id: z.string().min(1),
        type: z.string().min(1),
        licensePlate: z.string().min(1),
        kilometers: z.string().optional().or(z.literal('')),
        mitarbeiterName: z.string().optional().or(z.literal('')),
      })
    });
    const parseResult = schema.safeParse(await request.json());
    if (!parseResult.success) {
      return NextResponse.json({ error: 'Validierungsfehler', issues: parseResult.error.flatten() }, { status: 400 });
    }
    const { date, vehicle } = parseResult.data;

    // Aktuellen Benutzer über NextAuth ermitteln
    const currentUser = await getCurrentUser(request);

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: 'Ungültige Projekt-ID' },
        { status: 400 }
      );
    }

    if (!date || !vehicle) {
      return NextResponse.json(
        { error: 'Datum und Fahrzeug sind erforderlich' },
        { status: 400 }
      );
    }

    const project = await Project.findById(id);
    if (!project) {
      return NextResponse.json(
        { error: 'Projekt nicht gefunden' },
        { status: 404 }
      );
    }

    // Initialisiere fahrzeuge Objekt falls es nicht existiert
    if (!project.fahrzeuge) {
      project.fahrzeuge = {};
    }

    // Initialisiere Array für das Datum falls es nicht existiert
    if (!project.fahrzeuge[date]) {
      project.fahrzeuge[date] = [];
    }

    // Prüfe ob Fahrzeug bereits für dieses Datum zugewiesen ist
    const existingVehicle = project.fahrzeuge[date].find((v: any) => v.id === vehicle.id);
    if (existingVehicle) {
      return NextResponse.json(
        { error: 'Fahrzeug ist bereits für dieses Datum zugewiesen' },
        { status: 400 }
      );
    }

    // Füge Fahrzeug hinzu
    const vehicleAssignment = {
      id: vehicle.id,
      type: vehicle.type,
      licensePlate: vehicle.licensePlate,
      kilometers: vehicle.kilometers || '',
      mitarbeiterName: vehicle.mitarbeiterName || ''
    };

    project.fahrzeuge[date].push(vehicleAssignment);
    project.markModified('fahrzeuge');

    // Speichere das aktualisierte Projekt
    const updatedProject = await project.save();

    // Activity Log erstellen
    if (currentUser) {
      try {
        const activityLog = new ActivityLog({
          timestamp: new Date(),
          actionType: 'project_vehicle_assigned',
          module: 'project',
          performedBy: {
            userId: currentUser._id,
            name: currentUser.name,
            role: currentUser.role
          },
          details: {
            entityId: id,
            description: `Fahrzeug "${vehicle.type}" (${vehicle.licensePlate}) zum Projekt "${project.name}" zugewiesen`,
            after: {
              projectName: project.name,
              vehicleType: vehicle.type,
              licensePlate: vehicle.licensePlate,
              date: date,
              mitarbeiterName: vehicle.mitarbeiterName
            }
          }
        });
        
        await activityLog.save();
        console.log('Activity Log erstellt für Fahrzeug-Zuweisung');
      } catch (logError) {
        console.error('Fehler beim Erstellen des Activity Logs:', logError);
        // Activity Log Fehler sollte nicht die Hauptfunktion beeinträchtigen
      }
    }

    // Formatiere die Antwort
    const responseProject = {
      ...updatedProject.toObject(),
      id: updatedProject._id?.toString(),
      _id: updatedProject._id?.toString()
    };

    return NextResponse.json({
      success: true,
      message: 'Fahrzeug erfolgreich zugewiesen',
      project: responseProject
    });

  } catch (error) {
    console.error('Fehler beim Zuweisen des Fahrzeugs:', error);
    return NextResponse.json(
      { error: 'Fehler beim Zuweisen des Fahrzeugs' },
      { status: 500 }
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
    if (process.env.NODE_ENV === 'production' && csrf !== 'project-vehicle:unassign') {
      return NextResponse.json({ error: 'Ungültige Anforderung' }, { status: 400 });
    }
    const auth = await requireAuth(request, ['user','admin','superadmin']);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const schema = z.object({ date: z.string().min(8), vehicleId: z.string().min(1) });
    const parseResult = schema.safeParse(await request.json());
    if (!parseResult.success) {
      return NextResponse.json({ error: 'Validierungsfehler', issues: parseResult.error.flatten() }, { status: 400 });
    }
    const { date, vehicleId } = parseResult.data;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: 'Ungültige Projekt-ID' },
        { status: 400 }
      );
    }

    if (!date || !vehicleId) {
      return NextResponse.json(
        { error: 'Datum und Fahrzeug-ID sind erforderlich' },
        { status: 400 }
      );
    }

    const project = await Project.findById(id);
    if (!project) {
      return NextResponse.json(
        { error: 'Projekt nicht gefunden' },
        { status: 404 }
      );
    }

    if (!project.fahrzeuge || !project.fahrzeuge[date]) {
      return NextResponse.json(
        { error: 'Keine Fahrzeug-Zuweisungen für dieses Datum gefunden' },
        { status: 404 }
      );
    }

    // Entferne das Fahrzeug (robuster Vergleich)
    console.log('Fahrzeuge vor:', project.fahrzeuge[date]);
    project.fahrzeuge[date] = project.fahrzeuge[date].filter((v: any) => v.id?.toString() !== vehicleId?.toString());
    console.log('Fahrzeuge nach:', project.fahrzeuge[date]);

    // Wenn das Datum leer ist, entferne es komplett
    if (project.fahrzeuge[date].length === 0) {
      delete project.fahrzeuge[date];
    }

    project.markModified('fahrzeuge');

    // Speichere das aktualisierte Projekt
    const updatedProject = await project.save();

    // Formatiere die Antwort
    const responseProject = {
      ...updatedProject.toObject(),
      id: updatedProject._id?.toString(),
      _id: updatedProject._id?.toString()
    };

    return NextResponse.json({
      success: true,
      message: 'Fahrzeug erfolgreich entfernt',
      project: responseProject
    });

  } catch (error) {
    console.error('Fehler beim Entfernen des Fahrzeugs:', error);
    return NextResponse.json(
      { error: 'Fehler beim Entfernen des Fahrzeugs' },
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
    if (process.env.NODE_ENV === 'production' && csrf !== 'project-vehicle:update') {
      return NextResponse.json({ error: 'Ungültige Anforderung' }, { status: 400 });
    }
    const auth = await requireAuth(request, ['user','admin','superadmin']);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const schema = z.object({
      date: z.string().min(8),
      vehicleId: z.string().min(1),
      updatedFields: z.record(z.any())
    });
    const parseResult = schema.safeParse(await request.json());
    if (!parseResult.success) {
      return NextResponse.json({ error: 'Validierungsfehler', issues: parseResult.error.flatten() }, { status: 400 });
    }
    const { date, vehicleId, updatedFields } = parseResult.data;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Ungültige Projekt-ID' }, { status: 400 });
    }
    if (!date || !vehicleId || !updatedFields) {
      return NextResponse.json({ error: 'Datum, Fahrzeug-ID und updatedFields sind erforderlich' }, { status: 400 });
    }

    const project = await Project.findById(id);
    if (!project) {
      return NextResponse.json({ error: 'Projekt nicht gefunden' }, { status: 404 });
    }
    if (!project.fahrzeuge || !project.fahrzeuge[date]) {
      return NextResponse.json({ error: 'Keine Fahrzeug-Zuweisungen für dieses Datum gefunden' }, { status: 404 });
    }

    // Finde die Zuweisung und aktualisiere die Felder
    const assignment = project.fahrzeuge[date].find((v: any) => v.id === vehicleId);
    if (!assignment) {
      return NextResponse.json({ error: 'Fahrzeug-Zuweisung nicht gefunden' }, { status: 404 });
    }
    Object.assign(assignment, updatedFields);

    project.markModified('fahrzeuge');
    const updatedProject = await project.save();

    const responseProject = {
      ...updatedProject.toObject(),
      id: updatedProject._id?.toString(),
      _id: updatedProject._id?.toString()
    };

    return NextResponse.json({
      success: true,
      message: 'Fahrzeugzuweisung erfolgreich bearbeitet',
      project: responseProject
    });
  } catch (error) {
    console.error('Fehler beim Bearbeiten der Fahrzeugzuweisung:', error);
    return NextResponse.json(
      { error: 'Fehler beim Bearbeiten der Fahrzeugzuweisung' },
      { status: 500 }
    );
  }
} 