import { NextRequest, NextResponse } from 'next/server';
import { Project } from '../../../../lib/models/Project';
import ActivityLog from '../../../../lib/models/ActivityLog';
import User from '../../../../lib/models/User';
import { getCurrentUser } from '../../../../lib/auth/getCurrentUser';
import dbConnect from '../../../../lib/dbConnect';
import NotificationSettings from '../../../../lib/models/NotificationSettings';
import { DEFAULT_NOTIFICATION_DEFS } from '../../../../lib/notificationDefs';
import { sendEmail } from '../../../../lib/mailer';
import jsPDF from 'jspdf';
import NotificationLog from '../../../../lib/models/NotificationLog';
import { z } from 'zod';
import { requireAuth } from '../../../../lib/security/requireAuth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { message: 'Ungültige Projekt-ID' },
        { status: 400 }
      );
    }

    const project = await Project.findById(id);
    if (!project) {
      return NextResponse.json(
        { message: 'Projekt nicht gefunden' },
        { status: 404 }
      );
    }
    return NextResponse.json(project);
  } catch (error) {
    console.error('Fehler beim Laden des Projekts:', error);
    return NextResponse.json(
      { message: 'Fehler beim Laden des Projekts' },
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
    if (process.env.NODE_ENV === 'production' && csrf !== 'projects:update') {
      return NextResponse.json({ message: 'Ungültige Anforderung' }, { status: 400 });
    }
    const auth = await requireAuth(request, ['user','admin','superadmin']);
    if (!auth.ok) return NextResponse.json({ message: auth.error }, { status: auth.status });
    const schema = z.object({}).passthrough();
    const parseResult = schema.safeParse(await request.json());
    if (!parseResult.success) {
      return NextResponse.json({ message: 'Validierungsfehler', issues: parseResult.error.flatten() }, { status: 400 });
    }
    const body = parseResult.data;

    // Einheitlich NextAuth verwenden
    const currentUser = await getCurrentUser(request);

    if (!id) {
      return NextResponse.json(
        { message: 'Ungültige Projekt-ID' },
        { status: 400 }
      );
    }

    // Lade den ursprünglichen Projekt für Activity Log
    const originalProject = await Project.findById(id);
    if (!originalProject) {
      return NextResponse.json(
        { message: 'Projekt nicht gefunden' },
        { status: 404 }
      );
    }

    // Spezialbehandlung: Zeiten-Aktionen (add/edit/delete) über PUT-Body
    if (body && body.times && typeof body.times === 'object' && typeof (body.times as any).action === 'string') {
      const action = (body.times as any).action as 'add' | 'edit' | 'delete';
      try {
        const project = await Project.findById(id);
        if (!project) {
          return NextResponse.json({ message: 'Projekt nicht gefunden' }, { status: 404 });
        }

        // Stelle sicher, dass das Zeiten-Objekt existiert
        if (!project.mitarbeiterZeiten || typeof project.mitarbeiterZeiten !== 'object') {
          (project as any).mitarbeiterZeiten = {};
        }

        if (action === 'add') {
          const dates = Array.isArray((body.times as any).dates) ? (body.times as any).dates as string[] : [];
          const entry = (body.times as any).entry as any;
          if (!entry || !Array.isArray(dates) || dates.length === 0) {
            return NextResponse.json({ message: 'Ungültige Zeit-Daten (add)' }, { status: 400 });
          }
          for (const d of dates) {
            if (!(project as any).mitarbeiterZeiten[d]) {
              (project as any).mitarbeiterZeiten[d] = [];
            }
            (project as any).mitarbeiterZeiten[d].push(entry);
          }
        }

        if (action === 'edit') {
          const date = (body.times as any).date as string;
          const updatedEntry = (body.times as any).updatedEntry as any;
          if (!date || !updatedEntry || !updatedEntry.id) {
            return NextResponse.json({ message: 'Ungültige Zeit-Daten (edit)' }, { status: 400 });
          }
          const arr = ((project as any).mitarbeiterZeiten[date] || []) as any[];
          const idx = arr.findIndex(e => e && e.id === updatedEntry.id);
          if (idx !== -1) {
            arr[idx] = { ...arr[idx], ...updatedEntry };
            (project as any).mitarbeiterZeiten[date] = arr;
          }
        }

        if (action === 'delete') {
          const date = (body.times as any).date as string;
          const entryId = (body.times as any).entryId as string;
          if (!date || !entryId) {
            return NextResponse.json({ message: 'Ungültige Zeit-Daten (delete)' }, { status: 400 });
          }
          const arr = ((project as any).mitarbeiterZeiten[date] || []) as any[];
          (project as any).mitarbeiterZeiten[date] = arr.filter(e => e && e.id !== entryId);
          if ((project as any).mitarbeiterZeiten[date].length === 0) {
            delete (project as any).mitarbeiterZeiten[date];
          }
        }

        (project as any).markModified('mitarbeiterZeiten');
        await (project as any).save();

        return NextResponse.json(project);
      } catch (e) {
        console.error('Fehler bei Zeiten-Aktion über PUT:', e);
        return NextResponse.json({ message: 'Fehler bei Zeiten-Aktion' }, { status: 500 });
      }
    }

    // Spezialbehandlung: Technik-Aktionen (add/edit/remove) über PUT-Body
    if (body && body.technik && typeof body.technik === 'object' && typeof (body.technik as any).action === 'string') {
      const action = (body.technik as any).action as 'add' | 'edit' | 'remove';
      try {
        const project = await Project.findById(id);
        if (!project) {
          return NextResponse.json({ message: 'Projekt nicht gefunden' }, { status: 404 });
        }

        // Stelle sicher, dass das Technik-Objekt existiert
        if (!project.technik || typeof project.technik !== 'object') {
          (project as any).technik = {};
        }

        if (action === 'add') {
          const date = (body.technik as any).date as string;
          const technik = (body.technik as any).technik as { name: string; anzahl: number; meterlaenge: number; bemerkung?: string };
          if (!date || !technik || !technik.name) {
            return NextResponse.json({ message: 'Ungültige Technik-Daten (add)' }, { status: 400 });
          }
          const newTechnik = {
            id: Date.now().toString(),
            name: technik.name,
            anzahl: Number(technik.anzahl) || 0,
            meterlaenge: Number(technik.meterlaenge) || 0,
            bemerkung: technik.bemerkung || '',
          };
          if (!(project as any).technik[date]) {
            (project as any).technik[date] = [];
          }
          (project as any).technik[date].push(newTechnik);
        }

        if (action === 'edit') {
          const date = (body.technik as any).date as string | undefined;
          const technikId = (body.technik as any).technikId as string;
          const updatedTechnik = (body.technik as any).updatedTechnik as { name: string; anzahl: number; meterlaenge: number; bemerkung?: string };
          const selectedDays = (body.technik as any).selectedDays as string[] | undefined;
          if (!technikId || !updatedTechnik) {
            return NextResponse.json({ message: 'Ungültige Technik-Daten (edit)' }, { status: 400 });
          }
          const applyUpdate = (d: string) => {
            if (!(project as any).technik[d]) {
              (project as any).technik[d] = [];
            }
            const arr = (project as any).technik[d] as any[];
            const idx = arr.findIndex(t => t && t.id === technikId);
            if (idx !== -1) {
              arr[idx] = { ...arr[idx], ...updatedTechnik };
            } else {
              // Falls am Tag kein Eintrag existiert, neuen Eintrag mit gegebener ID anlegen
              arr.push({ id: technikId, ...updatedTechnik });
            }
            (project as any).technik[d] = arr;
          };
          if (Array.isArray(selectedDays) && selectedDays.length > 0) {
            selectedDays.forEach(d => applyUpdate(d));
          } else if (date) {
            applyUpdate(date);
          } else {
            return NextResponse.json({ message: 'Fehlendes Datum für Technik-Edit' }, { status: 400 });
          }
        }

        if (action === 'remove') {
          const date = (body.technik as any).date as string;
          const technikId = (body.technik as any).technikId as string;
          if (!date || !technikId) {
            return NextResponse.json({ message: 'Ungültige Technik-Daten (remove)' }, { status: 400 });
          }
          const currentArr = ((project as any).technik[date] || []) as any[];
          (project as any).technik[date] = currentArr.filter(t => t && t.id !== technikId);
          if ((project as any).technik[date].length === 0) {
            delete (project as any).technik[date];
          }
        }

        // ATW-Status und Meterlänge aktualisieren (global)
        const allTechnik: any[] = [];
        Object.values((project as any).technik).forEach((technikArray: any) => {
          if (Array.isArray(technikArray)) {
            allTechnik.push(...technikArray.filter(item => item && typeof item === 'object'));
          }
        });
        (project as any).atwsImEinsatz = allTechnik.length > 0;
        (project as any).anzahlAtws = allTechnik.reduce((sum: number, t: any) => sum + (Number(t?.anzahl) || 0), 0);
        (project as any).gesamtMeterlaenge = allTechnik.reduce((sum: number, t: any) => sum + (Number(t?.meterlaenge) || 0), 0);

        (project as any).markModified('technik');
        await (project as any).save();

        // Optional: Activity Log könnte hier ergänzt werden
        return NextResponse.json(project);
      } catch (e) {
        console.error('Fehler bei Technik-Aktion über PUT:', e);
        return NextResponse.json({ message: 'Fehler bei Technik-Aktion' }, { status: 500 });
      }
    }

    const project = await Project.findByIdAndUpdate(
      id,
      body,
      { new: true, runValidators: true }
    );

    if (!project) {
      return NextResponse.json(
        { message: 'Projekt nicht gefunden' },
        { status: 404 }
      );
    }

    // Activity Log erstellen
    if (currentUser) {
      try {
        const activityLog = new ActivityLog({
          timestamp: new Date(),
          actionType: 'project_updated',
          module: 'project',
          performedBy: {
            userId: currentUser._id,
            name: currentUser.name,
            role: currentUser.role
          },
          details: {
            entityId: id,
            description: `Projekt "${originalProject.name}" bearbeitet`,
            before: {
              name: originalProject.name,
              status: originalProject.status,
              datumBeginn: originalProject.datumBeginn,
              datumEnde: originalProject.datumEnde
            },
            after: {
              name: project.name,
              status: project.status,
              datumBeginn: project.datumBeginn,
              datumEnde: project.datumEnde
            }
          }
        });
        
        await activityLog.save();
        console.log('Activity Log erstellt für Projekt-Update');
      } catch (logError) {
        console.error('Fehler beim Erstellen des Activity Logs:', logError);
        // Activity Log Fehler sollte nicht die Hauptfunktion beeinträchtigen
      }
    }

    return NextResponse.json(project);
  } catch (error) {
    console.error('Fehler beim Aktualisieren des Projekts:', error);
    return NextResponse.json(
      { message: 'Fehler beim Aktualisieren des Projekts' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const { id } = await params;
    const csrf = request.headers.get('x-csrf-intent');
    if (process.env.NODE_ENV === 'production' && csrf !== 'projects:patch') {
      return NextResponse.json({ message: 'Ungültige Anforderung' }, { status: 400 });
    }
    const auth = await requireAuth(request, ['user','admin','superadmin']);
    if (!auth.ok) return NextResponse.json({ message: auth.error }, { status: auth.status });
    const schema = z.object({}).passthrough();
    const parseResult = schema.safeParse(await request.json());
    if (!parseResult.success) {
      return NextResponse.json({ message: 'Validierungsfehler', issues: parseResult.error.flatten() }, { status: 400 });
    }
    const body = parseResult.data;

    if (!id) {
      return NextResponse.json(
        { message: 'Ungültige Projekt-ID' },
        { status: 400 }
      );
    }

    const project = await Project.findByIdAndUpdate(
      id,
      body,
      { new: true, runValidators: true }
    );

    if (!project) {
      return NextResponse.json(
        { message: 'Projekt nicht gefunden' },
        { status: 404 }
      );
    }

    // Falls Status via PATCH auf "fertiggestellt" gesetzt wurde
    try {
      if (body && body.status === 'fertiggestellt') {
        const settings = await NotificationSettings.findOne({ scope: 'global' });
        const enabledByKey = new Map<string, boolean>(Object.entries(DEFAULT_NOTIFICATION_DEFS).map(([k, def]) => [k, def.defaultEnabled]));
        const configByKey = new Map<string, any>(Object.entries(DEFAULT_NOTIFICATION_DEFS).map(([k, def]) => [k, def.defaultConfig]));
        if (settings?.enabledByKey) for (const [k, v] of settings.enabledByKey.entries()) enabledByKey.set(k, v);
        if (settings?.configByKey) for (const [k, v] of settings.configByKey.entries()) configByKey.set(k, v);

        const notifKeyNew = 'Projekt auf „fertiggestellt“ gesetzt – E-Mail an Buchhaltung';
        const notifKeyOld = 'Projekt auf „geleistet“ gesetzt – E-Mail an Buchhaltung';
        const isEnabledNew = enabledByKey.get(notifKeyNew);
        const isEnabledOld = enabledByKey.get(notifKeyOld);
        const activeKey = isEnabledNew ? notifKeyNew : (isEnabledOld ? notifKeyOld : notifKeyNew);
        if (isEnabledNew || isEnabledOld) {
          const cfg = configByKey.get(activeKey) || {};
          const to = cfg.to || (DEFAULT_NOTIFICATION_DEFS as any)[activeKey].defaultConfig.to;

          const docPdf = new jsPDF();
          let y = 20;
          docPdf.setFontSize(18);
          docPdf.text(`Projektdetails: ${project.name}`, 14, y);
          y += 10;
          docPdf.setFontSize(11);
          docPdf.text(`Status: ${project.status}`, 14, y); y += 8;
          if (project.auftraggeber) { docPdf.text(`Auftraggeber: ${project.auftraggeber}`, 14, y); y += 8; }
          if (project.baustelle) { docPdf.text(`Baustelle: ${project.baustelle}`, 14, y); y += 8; }
          if (project.auftragsnummer) { docPdf.text(`Auftragsnummer: ${project.auftragsnummer}`, 14, y); y += 8; }
          if (project.datumBeginn) { docPdf.text(`Beginn: ${project.datumBeginn}`, 14, y); y += 8; }
          if (project.datumEnde) { docPdf.text(`Ende: ${project.datumEnde}`, 14, y); y += 8; }
          const pdfBuffer = Buffer.from(docPdf.output('arraybuffer'));

          const subject = `Projekt als \"fertiggestellt\" markiert: ${project.name}`;
          const html = `
            <p>Das Projekt <strong>${project.name}</strong> wurde soeben auf <strong>fertiggestellt</strong> gesetzt.</p>
            <p>Auftraggeber: ${project.auftraggeber || '-'}<br/>
            Baustelle: ${project.baustelle || '-'}<br/>
            Auftragsnummer: ${project.auftragsnummer || '-'}</p>
            <p>Die Projektdetails finden Sie im Anhang (PDF).</p>
          `;
          await sendEmail({
            to,
            subject,
            html,
            attachments: [
              { filename: `Projektdetails_${project.name}.pdf`, content: pdfBuffer, contentType: 'application/pdf' },
            ],
          });
        }
      }
    } catch (notifyErr) {
      console.error('Benachrichtigung (geleistet, PATCH) fehlgeschlagen:', notifyErr);
    }

    return NextResponse.json(project);
  } catch (error) {
    console.error('Fehler beim Aktualisieren des Projekts:', error);
    return NextResponse.json(
      { message: 'Fehler beim Aktualisieren des Projekts' },
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
    if (process.env.NODE_ENV === 'production' && csrf !== 'projects:delete') {
      return NextResponse.json({ message: 'Ungültige Anforderung' }, { status: 400 });
    }
    const auth = await requireAuth(request, ['admin','superadmin']);
    if (!auth.ok) return NextResponse.json({ message: auth.error }, { status: auth.status });

    if (!id) {
      return NextResponse.json(
        { message: 'Ungültige Projekt-ID' },
        { status: 400 }
      );
    }

    // Lade den Projekt vor dem Löschen für Activity Log
    const project = await Project.findById(id);
    if (!project) {
      return NextResponse.json(
        { message: 'Projekt nicht gefunden' },
        { status: 404 }
      );
    }

    // Activity Log erstellen
    if (auth.ok) {
      try {
        const currentUser = await getCurrentUser(request);
        const activityLog = new ActivityLog({
          timestamp: new Date(),
          actionType: 'project_deleted',
          module: 'project',
          performedBy: {
            userId: currentUser?._id || id,
            name: currentUser?.name || 'Unbekannt',
            role: currentUser?.role || 'unknown'
          },
          details: {
            entityId: id,
            description: `Projekt "${project.name}" gelöscht`,
            before: {
              name: project.name,
              status: project.status,
              datumBeginn: project.datumBeginn,
              datumEnde: project.datumEnde
            }
          }
        });
        
        await activityLog.save();
        console.log('Activity Log erstellt für Projekt-Löschung');
      } catch (logError) {
        console.error('Fehler beim Erstellen des Activity Logs:', logError);
        // Activity Log Fehler sollte nicht die Hauptfunktion beeinträchtigen
      }
    }

    // Projekt löschen
    await Project.findByIdAndDelete(id);

    return NextResponse.json({ message: 'Projekt erfolgreich gelöscht' });
  } catch (error) {
    console.error('Fehler beim Löschen des Projekts:', error);
    return NextResponse.json(
      { message: 'Fehler beim Löschen des Projekts' },
      { status: 500 }
    );
  }
} 