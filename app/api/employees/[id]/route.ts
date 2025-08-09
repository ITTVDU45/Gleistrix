import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '../../../../lib/dbConnect';
import { Employee } from '../../../../lib/models/Employee';
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
        { error: 'Ungültige Mitarbeiter-ID' },
        { status: 400 }
      );
    }

    // Lade den Mitarbeiter mit allen Feldern explizit
    const employee = await Employee.findById(id);
    if (!employee) {
      return NextResponse.json(
        { error: 'Mitarbeiter nicht gefunden' },
        { status: 404 }
      );
    }

    // Konvertiere zu einem einfachen Objekt und stelle sicher, dass vacationDays enthalten sind
    const employeeData = employee.toObject();
    const employeeWithVacationDays = {
      ...employeeData,
      vacationDays: employeeData.vacationDays || []
    };

    console.log('GET /api/employees/[id] - Employee data being returned:', employeeWithVacationDays);
    console.log('GET /api/employees/[id] - vacationDays length:', employeeWithVacationDays.vacationDays?.length);
    console.log('GET /api/employees/[id] - Raw employee.vacationDays:', employeeData.vacationDays);

    return NextResponse.json({ employee: employeeWithVacationDays });
  } catch (error) {
    console.error('Fehler beim Laden des Mitarbeiters:', error);
    return NextResponse.json(
      { error: 'Fehler beim Laden des Mitarbeiters' },
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
    if (process.env.NODE_ENV === 'production' && csrf !== 'employees:update') {
      return NextResponse.json({ error: 'Ungültige Anforderung' }, { status: 400 });
    }
    const auth = await requireAuth(request, ['admin','superadmin']);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const schema = z.object({
      name: z.string().min(1).optional(),
      position: z.string().optional().or(z.literal('')),
      email: z.string().email().optional(),
      phone: z.string().optional().or(z.literal('')),
      status: z.enum(['aktiv','nicht aktiv','urlaub']).optional(),
      elbaId: z.string().optional().or(z.literal('')),
      address: z.string().optional().or(z.literal('')),
      postalCode: z.string().optional().or(z.literal('')),
      city: z.string().optional().or(z.literal('')),
      vacationDays: z.array(z.object({ startDate: z.string(), endDate: z.string(), durationInDays: z.number().optional() })).optional(),
    }).passthrough();
    const parseResult = schema.safeParse(await request.json());
    if (!parseResult.success) {
      return NextResponse.json({ error: 'Validierungsfehler', issues: parseResult.error.flatten() }, { status: 400 });
    }
    const body = parseResult.data;

    const currentUser = await getCurrentUser(request);

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: 'Ungültige Mitarbeiter-ID' },
        { status: 400 }
      );
    }

    // Lade den ursprünglichen Mitarbeiter für Activity Log
    const originalEmployee = await Employee.findById(id);
    if (!originalEmployee) {
      return NextResponse.json(
        { error: 'Mitarbeiter nicht gefunden' },
        { status: 404 }
      );
    }

    // Nur erlaubte Felder updaten
    const allowedFields = ['name', 'miNumber', 'position', 'email', 'phone', 'status', 'elbaId', 'address', 'postalCode', 'city', 'einsaetze', 'vacationDays'];
    const updateData: any = {};
    for (const key of allowedFields) {
      if (body[key] !== undefined) updateData[key] = body[key];
    }

    console.log('Updating employee with data:', updateData);

    // Stelle sicher, dass vacationDays korrekt gespeichert werden
    let updated;
    if (body.vacationDays) {
      // Konvertiere die Datums-Strings zu Date-Objekten für Mongoose
      const vacationDaysWithDates = body.vacationDays.map((vacation: any) => ({
        ...vacation,
        startDate: new Date(vacation.startDate),
        endDate: new Date(vacation.endDate)
      }));
      
      console.log('Saving vacationDays with dates:', vacationDaysWithDates);
      
      // Speichere vacationDays explizit in der Datenbank
      const db = mongoose.connection.db;
      if (db) {
        // Direkte Aktualisierung in der Collection
        await db.collection('employees').updateOne(
          { _id: new mongoose.Types.ObjectId(id) },
          { 
            $set: {
              ...updateData,
              vacationDays: vacationDaysWithDates,
              updatedAt: new Date()
            }
          }
        );
        
        // Lade den aktualisierten Mitarbeiter
        updated = await Employee.findById(id);
      } else {
        // Fallback zur Mongoose-Methode
        updated = await Employee.findByIdAndUpdate(
          id, 
          { 
            $set: {
              ...updateData,
              vacationDays: vacationDaysWithDates 
            }
          }, 
          { new: true }
        );
      }
    } else {
      updated = await Employee.findByIdAndUpdate(id, updateData, { new: true });
    }
    
    if (!updated) {
      return NextResponse.json(
        { error: 'Mitarbeiter nicht gefunden' },
        { status: 404 }
      );
    }

    // Activity Log erstellen
    if (currentUser) {
      try {
        let actionType = 'employee_updated';
        let description = `Mitarbeiter "${originalEmployee.name}" bearbeitet`;
        
        // Spezielle Behandlung für Status-Änderungen
        if (body.status && body.status !== originalEmployee.status) {
          actionType = 'employee_status_changed';
          description = `Status von "${originalEmployee.name}" von "${originalEmployee.status}" auf "${body.status}" geändert`;
        }
        
        // Spezielle Behandlung für Urlaubszeiten
        if (body.vacationDays && body.vacationDays.length !== (originalEmployee.vacationDays?.length || 0)) {
          actionType = 'employee_vacation_added';
          description = `Urlaubszeiten für "${originalEmployee.name}" aktualisiert`;
        }

        const activityLog = new ActivityLog({
          timestamp: new Date(),
          actionType,
          module: 'employee',
          performedBy: {
            userId: currentUser._id,
            name: currentUser.name,
            role: currentUser.role
          },
          details: {
            entityId: id,
            description,
            before: {
              name: originalEmployee.name,
              status: originalEmployee.status,
              vacationDays: originalEmployee.vacationDays
            },
            after: {
              name: updated.name,
              status: updated.status,
              vacationDays: updated.vacationDays
            }
          }
        });
        
        await activityLog.save();
        console.log('Activity Log erstellt für Mitarbeiter-Update');
      } catch (logError) {
        console.error('Fehler beim Erstellen des Activity Logs:', logError);
        // Activity Log Fehler sollte nicht die Hauptfunktion beeinträchtigen
      }
    }

    // Stelle sicher, dass vacationDays in der Antwort enthalten sind
    const responseData = updated.toObject();
    
    console.log('Raw updated employee from database:', responseData);
    console.log('Raw vacationDays from database:', responseData.vacationDays);
    
    // Lade die vacationDays explizit aus der Datenbank
    const employeeWithVacationDays = {
      ...responseData,
      vacationDays: body.vacationDays || responseData.vacationDays || []
    };
    
    console.log('Updated employee data with vacationDays:', employeeWithVacationDays);

    return NextResponse.json({ 
      success: true, 
      employee: employeeWithVacationDays 
    });
  } catch (error) {
    console.error('Fehler beim Aktualisieren des Mitarbeiters:', error);
    return NextResponse.json(
      { error: 'Fehler beim Aktualisieren des Mitarbeiters' },
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
    if (process.env.NODE_ENV === 'production' && csrf !== 'employees:delete') {
      return NextResponse.json(
        { 
          success: false,
          message: 'Ungültige Anforderung' 
        },
        { status: 400 }
      );
    }
    const auth = await requireAuth(request, ['admin','superadmin']);
    if (!auth.ok) return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    
    const currentUser = await getCurrentUser(request);
    
    // Lade den Mitarbeiter vor dem Löschen für Activity Log
    const employee = await Employee.findById(id);
    
    if (!employee) {
      return NextResponse.json(
        { 
          success: false,
          message: 'Mitarbeiter nicht gefunden' 
        },
        { status: 404 }
      );
    }

    // Activity Log erstellen
    if (currentUser) {
      try {
        const activityLog = new ActivityLog({
          timestamp: new Date(),
          actionType: 'employee_deleted',
          module: 'employee',
          performedBy: {
            userId: currentUser._id,
            name: currentUser.name,
            role: currentUser.role
          },
          details: {
            entityId: id,
            description: `Mitarbeiter "${employee.name}" gelöscht`,
            before: {
              name: employee.name,
              position: employee.position,
              status: employee.status
            }
          }
        });
        
        await activityLog.save();
        console.log('Activity Log erstellt für Mitarbeiter-Löschung');
      } catch (logError) {
        console.error('Fehler beim Erstellen des Activity Logs:', logError);
        // Activity Log Fehler sollte nicht die Hauptfunktion beeinträchtigen
      }
    }

    // Mitarbeiter löschen
    await Employee.findByIdAndDelete(id);

    return NextResponse.json({ 
      success: true,
      message: 'Mitarbeiter erfolgreich gelöscht' 
    });
  } catch (error) {
    console.error('Fehler beim Löschen des Mitarbeiters:', error);
    return NextResponse.json(
      { 
        success: false,
        message: 'Fehler beim Löschen des Mitarbeiters' 
      },
      { status: 500 }
    );
  }
} 