import { NextResponse } from 'next/server';
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

export async function GET(request: Request) {
  try {
    await dbConnect();
    const url = new URL((request as any).url);
    const parts = url.pathname.split('/').filter(Boolean);
    const projectsIdx = parts.indexOf('projects');
    const id = projectsIdx >= 0 && parts.length > projectsIdx + 1 ? parts[projectsIdx + 1] : undefined;

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

export async function PUT(request: Request) {
  try {
    await dbConnect();
    const url = new URL((request as any).url);
    const parts = url.pathname.split('/').filter(Boolean);
    const projectsIdx = parts.indexOf('projects');
    const id = projectsIdx >= 0 && parts.length > projectsIdx + 1 ? parts[projectsIdx + 1] : undefined;
    const csrf = request.headers.get('x-csrf-intent');
    if (process.env.NODE_ENV === 'production' && csrf !== 'projects:update') {
      return NextResponse.json({ message: 'Ungültige Anforderung' }, { status: 400 });
    }
    const auth = await requireAuth(request as any, ['user','admin','superadmin']);
    if (!auth.ok) return NextResponse.json({ message: auth.error }, { status: auth.status });
    const schema = z.object({}).passthrough();
    const parseResult = schema.safeParse(await request.json());
    if (!parseResult.success) {
      return NextResponse.json({ message: 'Validierungsfehler', issues: parseResult.error.flatten() }, { status: 400 });
    }
    const body = parseResult.data;

    // Einheitlich NextAuth verwenden
    const currentUser = await getCurrentUser(request as any);

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
            try {
              const currentUser = await getCurrentUser(request as any);
              if (currentUser) {
                await ActivityLog.create({
                  timestamp: new Date(),
                  actionType: 'project_time_entry_added',
                  module: 'project',
                  performedBy: {
                    userId: (currentUser as any)._id,
                    name: (currentUser as any).name,
                    role: (currentUser as any).role
                  },
                  details: {
                    entityId: (project as any)._id,
                    description: `Zeiteintrag hinzugefügt: ${entry.name} am ${d} (${entry.start ?? ''}-${entry.ende ?? ''}, ${entry.stunden ?? ''}h)`,
                    after: { date: d, entry }
                  }
                } as any)
              }
            } catch (_) {}
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
            const before = { ...arr[idx] };
            arr[idx] = { ...arr[idx], ...updatedEntry };
            (project as any).mitarbeiterZeiten[date] = arr;
            try {
              const currentUser = await getCurrentUser(request as any);
              if (currentUser) {
                await ActivityLog.create({
                  timestamp: new Date(),
                  actionType: 'project_time_entry_updated',
                  module: 'project',
                  performedBy: {
                    userId: (currentUser as any)._id,
                    name: (currentUser as any).name,
                    role: (currentUser as any).role
                  },
                  details: {
                    entityId: (project as any)._id,
                    description: `Zeiteintrag geändert am ${date}: ${before.name} (${before.start ?? ''}-${before.ende ?? ''}) → (${arr[idx].start ?? ''}-${arr[idx].ende ?? ''})`,
                    before,
                    after: arr[idx]
                  }
                } as any)
              }
            } catch (_) {}
          }
        }

        if (action === 'delete') {
          const date = (body.times as any).date as string;
          const entryId = (body.times as any).entryId as string;
          if (!date || !entryId) {
            return NextResponse.json({ message: 'Ungültige Zeit-Daten (delete)' }, { status: 400 });
          }
          const arr = ((project as any).mitarbeiterZeiten[date] || []) as any[];
          const removed = arr.find(e => e && e.id === entryId);
          (project as any).mitarbeiterZeiten[date] = arr.filter(e => e && e.id !== entryId);
          if ((project as any).mitarbeiterZeiten[date].length === 0) {
            delete (project as any).mitarbeiterZeiten[date];
          }
          try {
            if (removed) {
              const currentUser = await getCurrentUser(request as any);
              if (currentUser) {
                await ActivityLog.create({
                  timestamp: new Date(),
                  actionType: 'project_time_entry_deleted',
                  module: 'project',
                  performedBy: {
                    userId: (currentUser as any)._id,
                    name: (currentUser as any).name,
                    role: (currentUser as any).role
                  },
                  details: {
                    entityId: (project as any)._id,
                    description: `Zeiteintrag gelöscht am ${date}: ${removed.name} (${removed.start ?? ''}-${removed.ende ?? ''})`,
                    before: removed
                  }
                } as any)
              }
            }
          } catch (_) {}
        }

        (project as any).markModified('mitarbeiterZeiten');
        await (project as any).save();

        return NextResponse.json(project);
      } catch (e) {
        console.error('Fehler bei Zeiten-Aktion über PUT:', e);
        return NextResponse.json({ message: 'Fehler bei Zeiten-Aktion' }, { status: 500 });
      }
    }

    // Spezialbehandlung: Fahrzeuge-Aktionen (assign/update/unassign) über PUT-Body
    if (body && body.vehicles && typeof body.vehicles === 'object' && typeof (body.vehicles as any).action === 'string') {
      const action = (body.vehicles as any).action as 'assign' | 'update' | 'unassign';
      try {
        const project = await Project.findById(id);
        if (!project) {
          return NextResponse.json({ message: 'Projekt nicht gefunden' }, { status: 404 });
        }

        if (!project.fahrzeuge || typeof project.fahrzeuge !== 'object') {
          (project as any).fahrzeuge = {};
        }

        if (action === 'assign') {
          const dates = Array.isArray((body.vehicles as any).dates) ? (body.vehicles as any).dates as string[] : [];
          const vehicle = (body.vehicles as any).vehicle as any;
          if (!vehicle || !vehicle.id || dates.length === 0) {
            return NextResponse.json({ message: 'Ungültige Fahrzeug-Daten (assign)' }, { status: 400 });
          }
          for (const d of dates) {
            if (!(project as any).fahrzeuge[d]) (project as any).fahrzeuge[d] = [];
            const arr = (project as any).fahrzeuge[d] as any[];
            if (!arr.some(v => v && v.id === vehicle.id)) {
              arr.push({
                id: vehicle.id,
                type: vehicle.type,
                licensePlate: vehicle.licensePlate,
                kilometers: vehicle.kilometers || '',
                mitarbeiterName: vehicle.mitarbeiterName || ''
              });
            }
            (project as any).fahrzeuge[d] = arr;
            try {
              const currentUser = await getCurrentUser(request as any);
              if (currentUser) {
                await ActivityLog.create({
                  timestamp: new Date(),
                  actionType: 'project_vehicle_assigned',
                  module: 'project',
                  performedBy: {
                    userId: (currentUser as any)._id,
                    name: (currentUser as any).name,
                    role: (currentUser as any).role
                  },
                  details: {
                    entityId: (project as any)._id,
                    description: `Fahrzeug zugewiesen am ${d}: ${vehicle.type} ${vehicle.licensePlate}`,
                    after: { date: d, vehicle }
                  }
                } as any)
              }
            } catch (_) {}
          }
        }

        if (action === 'update') {
          const date = (body.vehicles as any).date as string;
          const vehicleId = (body.vehicles as any).vehicleId as string;
          const updatedFields = (body.vehicles as any).updatedFields as Record<string, any>;
          if (!date || !vehicleId || !updatedFields) {
            return NextResponse.json({ message: 'Ungültige Fahrzeug-Daten (update)' }, { status: 400 });
          }
          const arr = ((project as any).fahrzeuge[date] || []) as any[];
          const idx = arr.findIndex(v => v && v.id === vehicleId);
          if (idx !== -1) {
            const before = { ...arr[idx] };
            arr[idx] = { ...arr[idx], ...updatedFields };
            (project as any).fahrzeuge[date] = arr;
            try {
              const currentUser = await getCurrentUser(request as any);
              if (currentUser) {
                await ActivityLog.create({
                  timestamp: new Date(),
                  actionType: 'project_vehicle_updated',
                  module: 'project',
                  performedBy: {
                    userId: (currentUser as any)._id,
                    name: (currentUser as any).name,
                    role: (currentUser as any).role
                  },
                  details: {
                    entityId: (project as any)._id,
                    description: `Fahrzeug aktualisiert am ${date}: ${before.type} ${before.licensePlate}`,
                    before,
                    after: arr[idx]
                  }
                } as any)
              }
            } catch (_) {}
          }
        }

        if (action === 'unassign') {
          const date = (body.vehicles as any).date as string;
          const vehicleId = (body.vehicles as any).vehicleId as string;
          if (!date || !vehicleId) {
            return NextResponse.json({ message: 'Ungültige Fahrzeug-Daten (unassign)' }, { status: 400 });
          }
          const arr = ((project as any).fahrzeuge[date] || []) as any[];
          const removed = arr.find(v => v && v.id === vehicleId);
          (project as any).fahrzeuge[date] = arr.filter(v => v && v.id !== vehicleId);
          if ((project as any).fahrzeuge[date].length === 0) {
            delete (project as any).fahrzeuge[date];
          }
          try {
            if (removed) {
              const currentUser = await getCurrentUser(request as any);
              if (currentUser) {
                await ActivityLog.create({
                  timestamp: new Date(),
                  actionType: 'project_vehicle_unassigned',
                  module: 'project',
                  performedBy: {
                    userId: (currentUser as any)._id,
                    name: (currentUser as any).name,
                    role: (currentUser as any).role
                  },
                  details: {
                    entityId: (project as any)._id,
                    description: `Fahrzeug entfernt am ${date}: ${removed.type} ${removed.licensePlate}`,
                    before: removed
                  }
                } as any)
              }
            }
          } catch (_) {}
        }

        (project as any).markModified('fahrzeuge');
        await (project as any).save();
        return NextResponse.json(project);
      } catch (e) {
        console.error('Fehler bei Fahrzeuge-Aktion über PUT:', e);
        return NextResponse.json({ message: 'Fehler bei Fahrzeuge-Aktion' }, { status: 500 });
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
          const date = (body.technik as any).date as string | undefined;
          const dates = (body.technik as any).dates as string[] | undefined;
          const technik = (body.technik as any).technik as { name: string; anzahl: number; meterlaenge: number; bemerkung?: string };
          if ((!date && (!Array.isArray(dates) || dates.length === 0)) || !technik || !technik.name) {
            return NextResponse.json({ message: 'Ungültige Technik-Daten (add)' }, { status: 400 });
          }

          const targetDays = Array.isArray(dates) && dates.length > 0 ? dates : (date ? [date] : []);
          const newEntryBase = {
            name: technik.name,
            anzahl: Number(technik.anzahl) || 0,
            meterlaenge: Number(technik.meterlaenge) || 0,
            bemerkung: technik.bemerkung || '',
          };

          for (const d of targetDays) {
            if (!(project as any).technik[d]) {
              (project as any).technik[d] = [];
            }
            const newTechnik = {
              id: Date.now().toString() + Math.random().toString(36).slice(2),
              ...newEntryBase,
            };
            (project as any).technik[d].push(newTechnik);
            try {
              const currentUser = await getCurrentUser(request as any);
              if (currentUser) {
                await ActivityLog.create({
                  timestamp: new Date(),
                  actionType: 'project_technology_added',
                  module: 'project',
                  performedBy: {
                    userId: (currentUser as any)._id,
                    name: (currentUser as any).name,
                    role: (currentUser as any).role
                  },
                  details: {
                    entityId: (project as any)._id,
                    description: `Technikeintrag hinzugefügt am ${d}: ${newEntryBase.name} (Anzahl ${newEntryBase.anzahl}, ${newEntryBase.meterlaenge} m)`,
                    after: { date: d, technik: newTechnik }
                  }
                } as any)
              }
            } catch (_) {}
          }
        }

        if (action === 'edit') {
          const date = (body.technik as any).date as string | undefined;
          const technikId = (body.technik as any).technikId as string;
          const updatedTechnik = (body.technik as any).updatedTechnik as { name: string; anzahl: number; meterlaenge: number; bemerkung?: string };
          const selectedDays = (body.technik as any).selectedDays as string[] | undefined;
          if (!technikId || !updatedTechnik) {
            return NextResponse.json({ message: 'Ungültige Technik-Daten (edit)' }, { status: 400 });
          }
          const applyUpdate = async (d: string) => {
            if (!(project as any).technik[d]) {
              (project as any).technik[d] = [];
            }
            const arr = (project as any).technik[d] as any[];
            const idx = arr.findIndex(t => t && t.id === technikId);
            if (idx !== -1) {
              const before = { ...arr[idx] };
              arr[idx] = { ...arr[idx], ...updatedTechnik };
              try {
                const currentUser = await getCurrentUser(request as any);
                if (currentUser) {
                  await ActivityLog.create({
                    timestamp: new Date(),
                    actionType: 'project_technology_updated',
                    module: 'project',
                    performedBy: {
                      userId: (currentUser as any)._id,
                      name: (currentUser as any).name,
                      role: (currentUser as any).role
                    },
                    details: {
                      entityId: (project as any)._id,
                      description: `Technikeintrag geändert am ${d}: ${before.name}`,
                      before,
                      after: arr[idx]
                    }
                  } as any)
                }
              } catch (_) {}
            } else {
              // Falls am Tag kein Eintrag existiert, neuen Eintrag mit gegebener ID anlegen
              arr.push({ id: technikId, ...updatedTechnik });
              try {
                const currentUser = await getCurrentUser(request as any);
                if (currentUser) {
                  await ActivityLog.create({
                    timestamp: new Date(),
                    actionType: 'project_technology_added',
                    module: 'project',
                    performedBy: {
                      userId: (currentUser as any)._id,
                      name: (currentUser as any).name,
                      role: (currentUser as any).role
                    },
                    details: {
                      entityId: (project as any)._id,
                      description: `Technikeintrag hinzugefügt am ${d}: ${updatedTechnik.name}`,
                      after: { date: d, technik: { id: technikId, ...updatedTechnik } }
                    }
                  } as any)
                }
              } catch (_) {}
            }
            (project as any).technik[d] = arr;
          };
          if (Array.isArray(selectedDays) && selectedDays.length > 0) {
            for (const d of selectedDays) {
              await applyUpdate(d);
            }
          } else if (date) {
            await applyUpdate(date);
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
          const removed = currentArr.find(t => t && t.id === technikId);
          (project as any).technik[date] = currentArr.filter(t => t && t.id !== technikId);
          if ((project as any).technik[date].length === 0) {
            delete (project as any).technik[date];
          }
          try {
            if (removed) {
              const currentUser = await getCurrentUser(request as any);
              if (currentUser) {
                await ActivityLog.create({
                  timestamp: new Date(),
                  actionType: 'project_technology_removed',
                  module: 'project',
                  performedBy: {
                    userId: (currentUser as any)._id,
                    name: (currentUser as any).name,
                    role: (currentUser as any).role
                  },
                  details: {
                    entityId: (project as any)._id,
                    description: `Technikeintrag entfernt am ${date}: ${removed.name}`,
                    before: removed
                  }
                } as any)
              }
            }
          } catch (_) {}
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

export async function PATCH(request: Request) {
  try {
    await dbConnect();
    const url = new URL((request as any).url);
    const parts = url.pathname.split('/').filter(Boolean);
    const projectsIdx = parts.indexOf('projects');
    const id = projectsIdx >= 0 && parts.length > projectsIdx + 1 ? parts[projectsIdx + 1] : undefined;
    const csrf = request.headers.get('x-csrf-intent');
    if (process.env.NODE_ENV === 'production' && csrf !== 'projects:patch') {
      return NextResponse.json({ message: 'Ungültige Anforderung' }, { status: 400 });
    }
    const auth = await requireAuth(request as any, ['user','admin','superadmin']);
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

export async function DELETE(request: Request) {
  try {
    await dbConnect();
    const url = new URL((request as any).url);
    const parts = url.pathname.split('/').filter(Boolean);
    const projectsIdx = parts.indexOf('projects');
    const id = projectsIdx >= 0 && parts.length > projectsIdx + 1 ? parts[projectsIdx + 1] : undefined;
    const csrf = request.headers.get('x-csrf-intent');
    if (process.env.NODE_ENV === 'production' && csrf !== 'projects:delete') {
      return NextResponse.json({ message: 'Ungültige Anforderung' }, { status: 400 });
    }
    const auth = await requireAuth(request as any, ['admin','superadmin']);
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
        const currentUser = await getCurrentUser(request as any);
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