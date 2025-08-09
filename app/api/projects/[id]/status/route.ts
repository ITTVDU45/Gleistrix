import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs'
import dbConnect from '../../../../../lib/dbConnect';
import { Project } from '../../../../../lib/models/Project';
import { getToken } from 'next-auth/jwt';
import mongoose from 'mongoose';
import NotificationSettings from '../../../../../lib/models/NotificationSettings';
import { DEFAULT_NOTIFICATION_DEFS } from '../../../../../lib/notificationDefs';
import { sendEmailResult } from '../../../../../lib/mailer';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import NotificationLog from '../../../../../lib/models/NotificationLog';
import { z } from 'zod';
import { requireAuth } from '../../../../../lib/security/requireAuth';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const csrf = req.headers.get('x-csrf-intent');
    if (process.env.NODE_ENV === 'production' && csrf !== 'projects:update-status') {
      return NextResponse.json({ error: 'Ungültige Anforderung' }, { status: 400 });
    }
    const auth = await requireAuth(req, ['user','admin','superadmin']);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    await dbConnect();
    const { id } = await params;
    const schema = z.object({ status: z.string().min(1) });
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validierungsfehler', issues: parsed.error.flatten() }, { status: 400 });
    }
    const { status } = parsed.data || {};

    if (!id || typeof status !== 'string') {
      return NextResponse.json({ error: 'Ungültige Daten' }, { status: 400 });
    }

    const project = await Project.findByIdAndUpdate(
      id,
      { status },
      { new: true, runValidators: true }
    );

    if (!project) {
      return NextResponse.json({ error: 'Projekt nicht gefunden' }, { status: 404 });
    }

    // Benachrichtigung: Projekt auf "geleistet" gesetzt
    if (status === 'geleistet') {
      console.log('[STATUS] Projekt auf "geleistet" gesetzt → Benachrichtigung prüfen');
      // Einstellungen laden und mit Defaults mergen
      const doc = await NotificationSettings.findOne({ scope: 'global' });
      const enabledByKey = new Map<string, boolean>(Object.entries(DEFAULT_NOTIFICATION_DEFS).map(([k, def]) => [k, def.defaultEnabled]));
      const configByKey = new Map<string, any>(Object.entries(DEFAULT_NOTIFICATION_DEFS).map(([k, def]) => [k, def.defaultConfig]));
      if (doc?.enabledByKey) for (const [k, v] of doc.enabledByKey.entries()) enabledByKey.set(k, v);
      if (doc?.configByKey) for (const [k, v] of doc.configByKey.entries()) configByKey.set(k, v);

      const notifKey = 'Projekt auf „geleistet“ gesetzt – E-Mail an Buchhaltung';
      const isEnabled = enabledByKey.get(notifKey);
      const cfg = configByKey.get(notifKey) || {};

      if (isEnabled) {
        const to = cfg.to || DEFAULT_NOTIFICATION_DEFS.project_marked_geleistet_email_to_accounting.defaultConfig.to;

        // PDF mit Projektdetails inkl. Logo, Zusammenfassung, Technik und allen Projekttagen erzeugen
        const docPdf = new jsPDF();
        let y = 20;
        try {
          // Logo mittig (optional)
          const { readFileSync, existsSync } = await import('fs');
          const { join } = await import('path');
          const logoPath = join(process.cwd(), 'public', 'mwd-logo.png');
          if (existsSync(logoPath)) {
            const img = readFileSync(logoPath);
            const base64 = `data:image/png;base64,${img.toString('base64')}`;
            const pageWidth = docPdf.internal.pageSize.getWidth();
            const logoW = 30;
            const logoH = 18;
            const logoX = (pageWidth - logoW) / 2;
            docPdf.addImage(base64, 'PNG', logoX, y, logoW, logoH);
            y += logoH + 8;
          }
        } catch {}

        // Titel
        docPdf.setFontSize(20);
        docPdf.text('Projektübersicht', docPdf.internal.pageSize.getWidth() / 2, y, { align: 'center' });
        y += 8;

        // Zusammenfassung (nebeneinander per zwei AutoTables, damit nichts überlappt)
        docPdf.setFontSize(12);
        const leftX = 14;
        const rightX = docPdf.internal.pageSize.getWidth() / 2 + 4;
        const startY = y + 8;

        const timesAny: any = (project as any).mitarbeiterZeiten || {};
        let totalHours = 0, totalTravelHours = 0;
        const uniqueEmployees = new Set<string>();
        const uniqueFunctions = new Set<string>();
        const exportedDays: string[] = [];
        Object.entries(timesAny).forEach(([date, arr]: any) => {
          exportedDays.push(String(date));
          (arr as any[]).forEach((e: any) => {
            if (typeof e.stunden === 'number') totalHours += e.stunden;
            if (typeof e.fahrtstunden === 'number') totalTravelHours += e.fahrtstunden;
            if (e.name) uniqueEmployees.add(e.name);
            if (e.funktion) uniqueFunctions.add(e.funktion);
          });
        });
        exportedDays.sort();
        const gesamtLaenge = (project as any).gesamtMeterlaenge || 0;

        // Linke Tabelle (Labels/Werte)
        autoTable(docPdf as any, {
          startY,
          margin: { left: leftX },
          tableWidth: docPdf.internal.pageSize.getWidth() / 2 - leftX - 6,
          theme: 'plain',
          styles: { fontSize: 10, cellPadding: 1.5 },
          body: [
            ['Projektname:', String((project as any).name || '-')],
            ['Status:', String((project as any).status || '-')],
            ['Gesamtarbeitsstunden:', totalHours.toFixed(2)],
            ['Technik Gesamtlänge:', `${gesamtLaenge} m`],
            ['Eingesetzte Funktionen:', String(uniqueFunctions.size)],
          ],
          columnStyles: { 0: { fontStyle: 'bold' } },
        });

        // Rechte Tabelle
        const zeitraum = `${(project as any).datumBeginn || '-'} - ${(project as any).datumEnde || '-'}`;
        autoTable(docPdf as any, {
          startY,
          margin: { left: rightX },
          tableWidth: docPdf.internal.pageSize.getWidth() - rightX - 12,
          theme: 'plain',
          styles: { fontSize: 10, cellPadding: 1.5 },
          body: [
            ['Auftraggeber:', String((project as any).auftraggeber || '-')],
            ['Zeitraum:', zeitraum],
            ['Gesamtfahrstunden:', totalTravelHours.toFixed(2)],
            ['Eingesetzte Mitarbeiter:', String(uniqueEmployees.size)],
          ],
          columnStyles: { 0: { fontStyle: 'bold' } },
        });

        const afterSummaryY = (docPdf as any).lastAutoTable.finalY + 8;
        // Exportierte Tage + Zeitpunkt als Block unter den Tabellen
        const ts = new Date().toLocaleString('de-DE');
        docPdf.setFontSize(12);
        docPdf.setFont(undefined, 'bold'); docPdf.text('Exportierte Tage:', leftX, afterSummaryY);
        docPdf.setFont(undefined, 'normal');
        const daysWrapped = docPdf.splitTextToSize(exportedDays.join(', '), docPdf.internal.pageSize.getWidth() - leftX - 12);
        docPdf.text(daysWrapped, leftX, afterSummaryY + 6);
        docPdf.setFont(undefined, 'bold'); docPdf.text('Exportzeitpunkt:', rightX, afterSummaryY);
        docPdf.setFont(undefined, 'normal'); docPdf.text(ts, rightX + 40, afterSummaryY);
        y = afterSummaryY + 12 + daysWrapped.length * 6;

        // Tabelle: Alle Projekttage aus mitarbeiterZeiten
        try {
          const entries: Array<{ datum: string; name: string; funktion?: string; stunden?: number; fahrtstunden?: number }> = [];
          const times: any = (project as any).mitarbeiterZeiten || {};
          Object.entries(times).forEach(([datum, arr]: any) => {
            (arr as any[]).forEach((e: any) => {
              entries.push({ datum, name: e.name, funktion: e.funktion, stunden: e.stunden, fahrtstunden: e.fahrtstunden });
            });
          });
          entries.sort((a, b) => a.datum.localeCompare(b.datum));
          if (entries.length > 0) {
            autoTable(docPdf as any, {
              startY: y + 4,
              head: [[ 'Datum', 'Mitarbeiter', 'Funktion', 'Stunden', 'Fahrstunden' ]],
              body: entries.map(e => [
                e.datum,
                e.name || '-',
                e.funktion || '-',
                typeof e.stunden === 'number' ? e.stunden.toFixed(1) : '-',
                typeof e.fahrtstunden === 'number' ? e.fahrtstunden.toFixed(1) : '-',
              ]),
              styles: { fontSize: 8, cellPadding: 2 },
              headStyles: { fillColor: [59,130,246], textColor: 255 },
            });
          }
        } catch (e) {
          console.log('PDF-Tabelle (Projekttage) konnte nicht erzeugt werden:', e);
        }

        // Technik-Tabelle
        try {
          const technik: any = (project as any).technik || {};
          const technikRows: any[] = [];
          const pushRow = (t: any, tag: string) => {
            technikRows.push([
              t?.name || '-',
              typeof t?.anzahl === 'number' ? String(t.anzahl) : (t?.anzahl || '-'),
              typeof t?.meterlaenge === 'number' ? `${t.meterlaenge} m` : (t?.meterlaenge || '-'),
              t?.bemerkung || '-',
              tag || '-',
            ]);
          };
          if (Array.isArray(technik)) {
            technik.forEach((t: any) => pushRow(t, '-'));
          } else {
            Object.entries(technik).forEach(([tag, arr]: any) => {
              (arr as any[]).forEach(t => pushRow(t, String(tag)));
            });
          }
          if (technikRows.length > 0) {
            autoTable(docPdf as any, {
              startY: (docPdf as any).lastAutoTable ? (docPdf as any).lastAutoTable.finalY + 12 : y + 10,
              head: [[ 'Name', 'Anzahl', 'Meterlänge', 'Bemerkung', 'Tag' ]],
              body: technikRows,
              styles: { fontSize: 8, cellPadding: 2 },
              headStyles: { fillColor: [241,245,249], textColor: 20 },
            });
          }
        } catch {}

        const pdfBuffer = Buffer.from(docPdf.output('arraybuffer'));

        const subject = `Projekt als \"geleistet\" markiert: ${project.name}`;
        const html = `
          <p>Das Projekt <strong>${project.name}</strong> wurde soeben auf <strong>geleistet</strong> gesetzt.</p>
          <p>Auftraggeber: ${project.auftraggeber}<br/>
          Baustelle: ${project.baustelle}<br/>
          Auftragsnummer: ${project.auftragsnummer}</p>
          <p>Die Projektdetails finden Sie im Anhang (PDF).</p>
        `;
        console.log(`[MAIL] Sende E-Mail an ${to} ...`);
        const result = await sendEmailResult({
          to,
          subject,
          html,
          attachments: [
            {
              filename: `Projektdetails_${project.name}.pdf`,
              content: pdfBuffer,
              contentType: 'application/pdf',
            },
          ],
        });
        console.log(`[MAIL] Ergebnis: ${result.ok ? 'OK' : 'FEHLER'}${result.error ? ' - ' + result.error : ''}`);

        try {
          const performerName = (auth as any)?.token?.name || (auth as any)?.token?.email || 'Unbekannt';
          await NotificationLog.create({
            key: notifKey,
            to,
            subject,
            success: result.ok,
            errorMessage: result.error,
            projectId: project._id,
            projectName: project.name,
            attachmentsCount: 1,
            meta: { status: project.status, performedBy: performerName },
          });
        } catch (logErr) {
          console.error('NotificationLog create error:', logErr);
        }
      }
    }

    return NextResponse.json({ success: true, project });
  } catch (e) {
    console.error('PUT /api/projects/[id]/status error', e);
    return NextResponse.json({ error: 'Fehler beim Aktualisieren des Status' }, { status: 500 });
  }
}


