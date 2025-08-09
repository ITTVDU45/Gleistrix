import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '../../../lib/dbConnect';
import { Employee } from '../../../lib/models/Employee';
import ActivityLog from '../../../lib/models/ActivityLog';
import { getCurrentUser } from '../../../lib/auth/getCurrentUser';
import { z } from 'zod';

export async function GET() {
  try {
    await dbConnect();
    const employees = await Employee.find({});
    
    // Stelle sicher, dass vacationDays in der Antwort enthalten sind
    const employeesWithVacationDays = employees.map(emp => {
      const employeeData = emp.toObject();
      return {
        ...employeeData,
        vacationDays: employeeData.vacationDays || []
      };
    });
    
    return NextResponse.json({ 
      success: true,
      employees: employeesWithVacationDays 
    });
  } catch (error) {
    console.error('Fehler beim Laden der Mitarbeiter:', error);
    return NextResponse.json(
      { 
        success: false,
        message: 'Fehler beim Laden der Mitarbeiter' 
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    const body = await request.json();
    // CSRF/Intent Header prüfen (einfacher Schutz)
    const intent = request.headers.get('x-csrf-intent');
    if (process.env.NODE_ENV === 'production' && intent !== 'employees:create') {
      return NextResponse.json({ success: false, message: 'Ungültige Anforderung' }, { status: 400 });
    }
    // Validierung
    const schema = z.object({
      name: z.string().min(1),
      position: z.string().optional(),
      email: z.string().email().optional().or(z.literal('')),
      phone: z.string().optional().or(z.literal('')),
      status: z.enum(['aktiv','nicht aktiv','urlaub']).optional(),
      elbaId: z.string().optional().or(z.literal('')),
      address: z.string().optional().or(z.literal('')),
      postalCode: z.string().optional().or(z.literal('')),
      city: z.string().optional().or(z.literal('')),
      vacationDays: z.array(z.object({
        startDate: z.string(),
        endDate: z.string(),
        durationInDays: z.number().optional(),
      })).optional(),
    });
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, message: 'Validierungsfehler', issues: parsed.error.flatten() }, { status: 400 });
    }
    const data = parsed.data;
    
    const currentUser = await getCurrentUser(request);
    
    // Validiere und setze das status-Feld
    if (!data.status) {
      data.status = 'aktiv';
    }
    
    // Logging für Debugging
    console.log('Neuer Mitarbeiter wird angelegt:', { name: data.name, position: data.position, status: data.status });
    
    const lastEmployee = await Employee.findOne({}, {}, { sort: { miNumber: -1 } });
    const nextMiNumber = lastEmployee && lastEmployee.miNumber ? lastEmployee.miNumber + 1 : 1;
    
    // Explizite Felder setzen statt spread operator
    const newEmployeeData = {
      name: data.name,
      position: data.position || '',
      email: data.email || '',
      phone: data.phone || '',
      status: data.status,
      elbaId: data.elbaId || '',
      address: data.address || '',
      postalCode: data.postalCode || '',
      city: data.city || '',
      miNumber: nextMiNumber,
      vacationDays: data.vacationDays || []
    };
    
    const employee = await Employee.create(newEmployeeData);
    
    // Prüfen, ob der Status tatsächlich gespeichert wurde
    if (employee && employee.status !== data.status) {
      console.warn('Status wurde nicht korrekt gespeichert:', {
        requested: data.status,
        saved: employee.status
      });
    }
    
    // Activity Log erstellen
    if (currentUser) {
      try {
        const activityLog = new ActivityLog({
          timestamp: new Date(),
          actionType: 'employee_created',
          module: 'employee',
          performedBy: {
            userId: currentUser._id,
            name: currentUser.name,
            role: currentUser.role
          },
          details: {
            entityId: employee._id,
              description: `Mitarbeiter "${data.name}" angelegt`,
            after: {
              name: data.name,
              position: data.position,
              status: data.status,
              miNumber: nextMiNumber
            }
          }
        });
        
        await activityLog.save();
        console.log('Activity Log erstellt für Mitarbeiter-Erstellung');
      } catch (logError) {
        console.error('Fehler beim Erstellen des Activity Logs:', logError);
        // Activity Log Fehler sollte nicht die Hauptfunktion beeinträchtigen
      }
    }
    
    // Konvertiere zu einem einfachen Objekt für JSON-Serialisierung
    const employeeResponse = employee.toObject();
    
    return NextResponse.json({ 
      success: true,
      data: employeeResponse 
    }, { status: 201 });
  } catch (error) {
    console.error('Fehler beim Erstellen des Mitarbeiters:', error);
    return NextResponse.json(
      { 
        success: false,
        message: 'Fehler beim Erstellen des Mitarbeiters' 
      },
      { status: 500 }
    );
  }
} 