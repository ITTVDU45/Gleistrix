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