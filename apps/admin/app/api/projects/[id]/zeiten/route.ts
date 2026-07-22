import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server';
import { Project } from '@/lib/models/Project';
import ActivityLog from '@/lib/models/ActivityLog';
import { getCurrentUser } from '@/lib/auth/getCurrentUser';
import dbConnect from '@/lib/dbConnect';
import { format, parseISO } from 'date-fns';
import { z } from 'zod';
import { requireAuth } from '@/lib/security/requireAuth';
import { Employee } from '@/lib/models/Employee';
import {
  findEmployeeAbsenceOnDay,
  formatEmployeeAbsenceConflict,
} from '@/lib/employeeAbsence';
import type { VacationDay } from '@/types/main';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await dbConnect();
  const { id } = await params;
  try {
    const csrf = req.headers.get('x-csrf-intent');
    if (process.env.NODE_ENV === 'production' && csrf !== 'project-times:create') {
      return NextResponse.json({ error: 'Ungültige Anforderung' }, { status: 400 });
    }
    const auth = await requireAuth(req, ['user','admin','superadmin']);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const schema = z.object({
      date: z.string().min(8),
      entry: z.object({
        id: z.string().optional(),
        employeeId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
        name: z.string().min(1),
        stunden: z.number().nonnegative(),
        funktion: z.string().optional().or(z.literal('')),
        isExternal: z.boolean().optional(),
      }).passthrough()
    });
    const parseResult = schema.safeParse(await req.json());
    if (!parseResult.success) {
      return NextResponse.json({ error: 'Validierungsfehler', issues: parseResult.error.flatten() }, { status: 400 });
    }
    let { date } = parseResult.data;
    const entry = { ...parseResult.data.entry } as typeof parseResult.data.entry & { employeeId?: string };

    const currentUser = await getCurrentUser(req);

    if (!date || !entry) {
      return NextResponse.json({ error: 'Datum und Eintrag sind erforderlich.' }, { status: 400 });
    }
    // Datum immer als yyyy-MM-dd speichern
    if (date.length > 10) {
      date = format(parseISO(date), 'yyyy-MM-dd');
    }
    const employeeMatches = entry.isExternal
      ? []
      : await Employee.find(entry.employeeId ? { _id: entry.employeeId } : { name: entry.name }).select('name vacationDays').limit(2).lean();
    const employeeResult = employeeMatches.length === 1 ? employeeMatches[0] : null;
    if (!entry.isExternal && entry.employeeId && !employeeResult) {
      return NextResponse.json({ error: 'Mitarbeiter-ID ist ungültig.' }, { status: 400 });
    }
    if (!entry.isExternal && !entry.employeeId && employeeMatches.length > 1) {
      return NextResponse.json({ error: `Mitarbeitername „${entry.name}“ ist nicht eindeutig.` }, { status: 409 });
    }
    if (employeeResult) {
      entry.employeeId = String(employeeResult._id);
      entry.name = String(employeeResult.name);
    }
    const employee = employeeResult as unknown as { vacationDays?: VacationDay[] } | null;
    const absence = employee
      ? findEmployeeAbsenceOnDay(employee.vacationDays as VacationDay[] | undefined, date)
      : undefined;
    if (absence) {
      return NextResponse.json(
        { error: formatEmployeeAbsenceConflict(entry.name, absence) },
        { status: 409 }
      );
    }
    const project = await Project.findById(id);
    if (!project) {
      return NextResponse.json({ error: 'Projekt nicht gefunden.' }, { status: 404 });
    }

    // Projektübergreifende Blockierungsprüfung
    // const allProjects = await Project.find({});
    // const conflictProject = allProjects.find(p =>
    //   p.mitarbeiterZeiten?.[date]?.some((e: any) => e.name === entry.name)
    // );
    // if (conflictProject) {
    //   return NextResponse.json(
    //     { error: `Mitarbeiter ${entry.name} ist am ${date} bereits im Projekt "${conflictProject.name}" eingetragen.` },
    //     { status: 409 }
    //   );
    // }
    // Debug: Vor dem Speichern
    logger.debug('--- ZEITEN DEBUG ---');
    logger.debug('API empfängt Eintrag:', entry);
    logger.debug('Vorher (mitarbeiterZeiten):', JSON.stringify(project.mitarbeiterZeiten));
    logger.debug('Vorher (Keys):', Object.keys(project.mitarbeiterZeiten || {}));
    if (!project.mitarbeiterZeiten) project.mitarbeiterZeiten = {};
    if (!project.mitarbeiterZeiten[date]) project.mitarbeiterZeiten[date] = [];
    project.mitarbeiterZeiten[date].push(entry);
    project.markModified('mitarbeiterZeiten');
    await project.save();

    // Activity Log erstellen
    if (currentUser) {
      try {
        const activityLog = new ActivityLog({
          timestamp: new Date(),
          actionType: 'project_time_entry_added',
          module: 'project',
          performedBy: {
            userId: currentUser._id,
            name: currentUser.name,
            role: currentUser.role
          },
          details: {
            entityId: id,
            description: `Zeiteintrag für "${entry.name}" (${entry.stunden}h) zum Projekt "${project.name}" hinzugefügt`,
            after: {
              projectName: project.name,
              employeeName: entry.name,
              stunden: entry.stunden,
              date: date,
              funktion: entry.funktion
            }
          }
        });

        await activityLog.save();
        logger.debug('Activity Log erstellt für Zeiteintrag-Hinzufügung');
      } catch (logError) {
        logger.error('Fehler beim Erstellen des Activity Logs:', logError);
        // Activity Log Fehler sollte nicht die Hauptfunktion beeinträchtigen
      }
    }

    // Debug: Nach dem Speichern
    logger.debug('Nachher (mitarbeiterZeiten):', JSON.stringify(project.mitarbeiterZeiten, null, 2));
    logger.debug('Nachher (Keys):', Object.keys(project.mitarbeiterZeiten));
    const updatedProject = await Project.findById(id).lean();
    if (updatedProject) {
      (updatedProject as any).id = (updatedProject as any)._id?.toString();
    }
    const debugMZ = (updatedProject as any)?.mitarbeiterZeiten || {};
    logger.debug('Response (mitarbeiterZeiten):', JSON.stringify(debugMZ));
    logger.debug('Response (Keys):', Object.keys(debugMZ));
    return NextResponse.json({ success: true, project: updatedProject }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: 'Fehler beim Hinzufügen des Zeiteintrags.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await dbConnect();
  const { id } = await params;
  try {
    const csrf = req.headers.get('x-csrf-intent');
    if (process.env.NODE_ENV === 'production' && csrf !== 'project-times:delete') {
      return NextResponse.json({ error: 'Ungültige Anforderung' }, { status: 400 });
    }
    const auth = await requireAuth(req, ['user','admin','superadmin']);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const schema = z.object({ date: z.string().min(8), entryId: z.string().min(1) });
    const parseResult = schema.safeParse(await req.json());
    if (!parseResult.success) {
      return NextResponse.json({ error: 'Validierungsfehler', issues: parseResult.error.flatten() }, { status: 400 });
    }
    const { date, entryId } = parseResult.data;
    if (!date || !entryId) {
      return NextResponse.json({ error: 'Datum und Eintrag-ID sind erforderlich.' }, { status: 400 });
    }
    const project = await Project.findById(id);
    if (!project) {
      return NextResponse.json({ error: 'Projekt nicht gefunden.' }, { status: 404 });
    }
    if (!project.mitarbeiterZeiten || !project.mitarbeiterZeiten[date]) {
      return NextResponse.json({ error: 'Kein Zeiteintrag für dieses Datum gefunden.' }, { status: 404 });
    }
    // Filtere den Eintrag heraus
    project.mitarbeiterZeiten[date] = project.mitarbeiterZeiten[date].filter((e: any) => e.id !== entryId);
    // Wenn das Array leer ist, entferne das Datum
    if (project.mitarbeiterZeiten[date].length === 0) {
      delete project.mitarbeiterZeiten[date];
    }
    project.markModified('mitarbeiterZeiten');
    await project.save();
    const updatedProject = await Project.findById(id).lean();
    if (updatedProject) {
      (updatedProject as any).id = (updatedProject as any)._id?.toString();
    }
    return NextResponse.json({ success: true, project: updatedProject }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: 'Fehler beim Löschen des Zeiteintrags.' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await dbConnect();
  const { id } = await params;
  try {
    const csrf = req.headers.get('x-csrf-intent');
    if (process.env.NODE_ENV === 'production' && csrf !== 'project-times:update') {
      return NextResponse.json({ error: 'Ungültige Anforderung' }, { status: 400 });
    }
    const auth = await requireAuth(req, ['user','admin','superadmin']);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const schema = z.object({
      date: z.string().min(8),
      updatedEntry: z.object({ id: z.string().min(1) }).passthrough(),
      selectedDays: z.array(z.string()).optional(),
    });
    const parseResult = schema.safeParse(await req.json());
    if (!parseResult.success) {
      return NextResponse.json({ error: 'Validierungsfehler', issues: parseResult.error.flatten() }, { status: 400 });
    }
    const { date, updatedEntry, selectedDays } = parseResult.data;
    if (!date || !updatedEntry || !updatedEntry.id) {
      return NextResponse.json({ error: 'Datum und Eintrag (mit id) sind erforderlich.' }, { status: 400 });
    }
    const project = await Project.findById(id);
    if (!project) {
      return NextResponse.json({ error: 'Projekt nicht gefunden.' }, { status: 404 });
    }
    const days = Array.isArray(selectedDays) && selectedDays.length > 0 ? selectedDays : [date];
    for (const d of days) {
      if (!project.mitarbeiterZeiten[d]) continue;
      const idx = project.mitarbeiterZeiten[d].findIndex((e: any) => e.id === updatedEntry.id);
      if (idx !== -1) {
        project.mitarbeiterZeiten[d][idx] = { ...project.mitarbeiterZeiten[d][idx], ...updatedEntry };
      }
    }
    project.markModified('mitarbeiterZeiten');
    await project.save();
    const updatedProject = await Project.findById(id).lean();
    if (updatedProject) {
      (updatedProject as any).id = (updatedProject as any)._id?.toString();
    }
    return NextResponse.json({ success: true, project: updatedProject }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: 'Fehler beim Bearbeiten des Zeiteintrags.' }, { status: 500 });
  }
}
