import { NextRequest, NextResponse } from 'next/server'
import dbConnect from '@/lib/dbConnect'
import { Project } from '@/lib/models/Project'
import { requireAuth } from '@/lib/security/requireAuth'
import { sendEmailResult } from '@/lib/mailer'
import { createPDFForProjectDays } from '@/lib/pdfExport'
import NotificationSettings from '@/lib/models/NotificationSettings'
import { DEFAULT_NOTIFICATION_DEFS } from '@/lib/notificationDefs'
import NotificationLog from '@/lib/models/NotificationLog'
import ActivityLog from '@/lib/models/ActivityLog'
import BillingPosition from '@/lib/models/BillingPosition'
import { normalizeProjectTimeEntriesToBillingRows } from '@/lib/timeEntry/billingRows'
import mongoose from 'mongoose'

export async function POST(req: NextRequest){
  try{
    await dbConnect()
    const auth = await requireAuth(req as any, ['user','admin','superadmin'])
    if (!auth.ok) return NextResponse.json({ message: auth.error }, { status: auth.status })

    const body = await req.json()
    const { projectId } = body
    // Coerce days/copyDays robust zu string[]
    const toStringArray = (v: any): string[] => {
      if (Array.isArray(v)) return v.map((x: any) => String(x)).filter(Boolean)
      if (typeof v === 'string' && v.includes(',')) return v.split(',').map(s => s.trim()).filter(Boolean)
      if (typeof v === 'string' && v.trim()) return [v.trim()]
      if (typeof v === 'number') return [String(v)]
      return []
    }
    const days: string[] = toStringArray(body.days)
    const copyDays: string[] = toStringArray(body.copyDays)
    const selectedRowKeys: string[] = toStringArray(body.selectedRowKeys)
    if (!projectId) return NextResponse.json({ message: 'projectId fehlt' }, { status: 400 })

    const project = await Project.findById(projectId).lean()
    if (!project) return NextResponse.json({ message: 'Projekt nicht gefunden' }, { status: 404 })

    const allRows = normalizeProjectTimeEntriesToBillingRows((project as any)?.mitarbeiterZeiten || {}, days)
    const selectedRows = selectedRowKeys.length > 0
      ? allRows.filter((row) => selectedRowKeys.includes(row.rowKey))
      : allRows
    if (selectedRows.length === 0) {
      return NextResponse.json({ message: 'Keine abrechenbaren Positionen ausgewählt' }, { status: 400 })
    }

    const tokenUserId = String((auth as any).token?.id || '')
    const billedByUserId = mongoose.isValidObjectId(tokenUserId)
      ? new mongoose.Types.ObjectId(tokenUserId)
      : undefined

    const alreadyBilledDocs: any[] = selectedRows.length > 0
      ? await BillingPosition.find({ projectId, rowKey: { $in: selectedRows.map((r) => r.rowKey) } }).lean()
      : []
    const alreadyBilledSet = new Set(alreadyBilledDocs.map((d: any) => String(d.rowKey)))

    const billingDocsPayload = selectedRows.map((row) => ({
      projectId: (project as any)._id,
      day: row.day,
      rowKey: row.rowKey,
      sourceEntryId: row.sourceEntryId,
      funktion: row.funktion,
      count: row.count,
      hoursPerUnit: row.stundenPerUnit,
      hoursTotal: row.stundenTotal,
      isExternal: row.isExternal,
      companyName: row.companyName,
      employeeName: row.employeeName,
      status: (alreadyBilledSet.has(row.rowKey) || copyDays.includes(row.day)) ? 'copied' : 'billed',
      billedAt: new Date(),
      billedBy: {
        userId: billedByUserId,
        name: (auth as any).token?.name || (auth as any).token?.email || 'system',
        role: (auth as any).token?.role || 'user',
      }
    }))

    if (billingDocsPayload.length > 0) {
      await BillingPosition.insertMany(billingDocsPayload)
    }

    // Erzeuge PDF(s) via helper (wird in lib/pdfExport erwartet)
    const pdfBuffers: Array<{ filename: string; buffer: Buffer }> = []
    try {
      console.debug('Abrechnung request', { projectId, days: Array.isArray(days) ? days.length : 0, copyDays: Array.isArray(copyDays) ? copyDays.length : 0 })
      if (typeof createPDFForProjectDays === 'function'){
        const pseudoTimesByDay: Record<string, any[]> = {}
        selectedRows.forEach((row) => {
          if (!pseudoTimesByDay[row.day]) pseudoTimesByDay[row.day] = []
          pseudoTimesByDay[row.day].push({
            id: row.rowKey,
            name: row.isExternal ? row.companyName : row.employeeName,
            funktion: row.funktion,
            count: row.count,
            externalCount: row.count,
            start: row.start,
            ende: row.ende,
            stunden: row.stundenTotal,
            fahrtstunden: row.fahrtstundenTotal,
            pause: row.pause,
            extra: row.extraTotal,
            nachtzulage: String(row.nachtzulageTotal),
            sonntag: row.sonntagsstundenTotal,
            sonntagsstunden: row.sonntagsstundenTotal,
            feiertag: row.feiertagTotal,
            bemerkung: row.bemerkung,
          })
        })
        const pdfProject = { ...(project as any), mitarbeiterZeiten: pseudoTimesByDay }
        const buf = await createPDFForProjectDays(pdfProject as any, Array.from(new Set(selectedRows.map((r) => r.day))))
        const projectName = ((project as any)?.name ?? 'projekt') as string
        pdfBuffers.push({ filename: `${projectName}-abrechnung.pdf`, buffer: buf })
      }
    } catch (pdfErr) {
      console.error('Failed to generate PDF for abrechnung', pdfErr)
      return NextResponse.json({ message: 'Fehler beim Erstellen der Abrechnungs-PDF' }, { status: 500 })
    }

    // Send email using NotificationSettings (global) if configured, fallback to ENV
    const settingsDoc = await NotificationSettings.findOne({ scope: 'global' });
    const enabledByKey = new Map<string, boolean>(Object.entries(DEFAULT_NOTIFICATION_DEFS).map(([k, def]) => [k, def.defaultEnabled]));
    const configByKey = new Map<string, any>(Object.entries(DEFAULT_NOTIFICATION_DEFS).map(([k, def]) => [k, def.defaultConfig]));
    if (settingsDoc?.enabledByKey) for (const [k, v] of settingsDoc.enabledByKey.entries()) enabledByKey.set(k, v);
    if (settingsDoc?.configByKey) for (const [k, v] of settingsDoc.configByKey.entries()) configByKey.set(k, v);

    const notifKey = 'Abrechnung erstellt – E-Mail an Buchhaltung';
    const isEnabled = Boolean(enabledByKey.get(notifKey));
    const cfg = configByKey.get(notifKey) || {};
    const defaultNotif = (DEFAULT_NOTIFICATION_DEFS as any)[notifKey];
    const defaultRecipient = defaultNotif?.defaultConfig?.to || process.env.ABBRECHNUNG_EMAIL || process.env.EMAIL_FROM || 'admin@example.com';
    const to = isEnabled ? (cfg.to || defaultRecipient) : defaultRecipient;

    // Attach project documents from MinIO if present
    const emailAttachments: any[] = []
    for (const p of pdfBuffers) emailAttachments.push({ filename: p.filename, content: p.buffer, contentType: 'application/pdf' })
    const projDocsAll = ((project as any)?.dokumente?.all ?? []) as any[]
    if (Array.isArray(projDocsAll) && projDocsAll.length > 0) {
      const bucket = process.env.MINIO_BUCKET || 'project-documents'
      const { getObjectBufferAsync } = await import('@/lib/storage/minioClient')
      for (const pd of projDocsAll) {
        try {
          // doc.url may contain minio://{bucket}/{key} or a direct url — try to parse key
          let key = pd.key || ''
          if (!key && typeof pd.url === 'string' && pd.url.startsWith('minio://')) {
            key = pd.url.replace(`minio://${bucket}/`, '')
          }
          if (key) {
            const buf = await getObjectBufferAsync(bucket, key)
            emailAttachments.push({ filename: pd.name, content: buf })
          }
        } catch (e) {
          console.warn('Failed to attach project doc from MinIO', e)
        }
      }
    }

    // Compose informative email body using normalized billing rows
    const totalHours = selectedRows.reduce((sum, row) => sum + row.stundenTotal, 0)
    const uniqueEmployees = new Set<string>()
    selectedRows.forEach((row) => {
      if (row.isExternal) {
        if (row.companyName) uniqueEmployees.add(row.companyName)
      } else {
        if (row.employeeName) uniqueEmployees.add(row.employeeName)
      }
    })

    // Build detailed HTML with per-day + function breakdown
    const copySet = new Set(Array.isArray(copyDays) ? copyDays : [])
    const dayRows: string[] = []
    const daysFromRows = Array.from(new Set(selectedRows.map((row) => row.day))).sort()
    for (const d of daysFromRows) {
      const rowsForDay = selectedRows.filter((row) => row.day === d)
      const perEmp: Record<string, number> = {}
      let dayTotal = 0
      for (const row of rowsForDay) {
        const who = row.isExternal
          ? `${row.companyName || 'Extern'} (${row.count}x ${row.funktion})`
          : `${row.employeeName || 'Unbekannt'} (${row.funktion})`
        const hrs = row.stundenTotal || 0
        dayTotal += hrs
        perEmp[who] = (perEmp[who] || 0) + hrs
      }
      const empLines = Object.entries(perEmp).map(([name, h]) => `<li>${name}: ${h.toFixed(2)}h</li>`).join('')
      const copyNote = copySet.has(d) ? ' <strong style="color:#b45309">(Kopie)</strong>' : ''
      dayRows.push(`<tr><td style="vertical-align:top;padding:6px;border:1px solid #e5e7eb">${d}${copyNote}</td><td style="padding:6px;border:1px solid #e5e7eb"><ul style="margin:0;padding-left:16px">${empLines}</ul></td><td style="padding:6px;border:1px solid #e5e7eb;text-align:right">${dayTotal.toFixed(2)}h</td></tr>`)
    }

    const attachmentListHtml = (emailAttachments || []).map(a => `<li>${a.filename}</li>`).join('') || '<li>Keine Anhänge</li>'

    // Try to inline logo if available
    let logoHtml = ''
    try {
      const { readFileSync, existsSync } = await import('fs')
      const { join } = await import('path')
      const logoPath = join(process.cwd(), 'public', 'mwd-logo.png')
      if (existsSync(logoPath)) {
        const img = readFileSync(logoPath)
        const base64 = img.toString('base64')
        logoHtml = `<div style="text-align:left;margin-bottom:12px"><img src="data:image/png;base64,${base64}" alt="Logo" style="height:48px"/></div>`
      }
    } catch (e) {
      // ignore
    }

    const subjectText = `Abrechnung für Projekt „${(project as any).name}“ – Mülheimer Wachdienst GmbH Zeiterfassung${copySet.size>0 ? ' (enthält Kopien bereits abgerechneter Tage)' : ''}`

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; color: #111;">
        ${logoHtml}
        <h2 style="font-size:18px;margin-bottom:6px">Abrechnung für Projekt „${(project as any).name}“ – Mülheimer Wachdienst GmbH Zeiterfassung</h2>
        <p>Sehr geehrte Damen und Herren,</p>
        <p>für das Projekt „<strong>${(project as any).name}</strong>“ wurde auf Basis der durch das System Gleistrix - Mülheimerwachdienst GmbH erfassten Einsatzzeiten eine Abrechnung generiert. Nachfolgend finden Sie eine detaillierte Übersicht der geleisteten Stunden und eingesetzten Mitarbeitenden:</p>
        <h4 style="margin-bottom:6px">🔎 Projektübersicht:</h4>
        <ul style="margin-top:0;margin-bottom:8px;font-size:13px">
          <li><strong>Projektname:</strong> ${(project as any).name}</li>
          <li><strong>Erfasste Tage:</strong> ${daysFromRows.length}</li>
          <li><strong>Beteiligte Mitarbeitende:</strong> ${uniqueEmployees.size}</li>
          <li><strong>Gesamteinsatzzeit:</strong> ${totalHours.toFixed(2)} Stunden</li>
        </ul>

        <h4 style="margin-bottom:6px">📅 Erfasste Zeiten im Detail:</h4>
        <table style="border-collapse:collapse;width:100%;max-width:700px;font-family: Arial, sans-serif;font-size:12px;color:#111;border:1px solid #e6eef8">
          <thead>
            <tr style="background:#0ea5e9;color:#fff;font-weight:600;font-size:12px;">
              <th style="text-align:left;padding:8px;border-right:1px solid rgba(255,255,255,0.08)">Datum</th>
              <th style="text-align:left;padding:8px;border-right:1px solid rgba(255,255,255,0.08)">Mitarbeitende</th>
              <th style="text-align:right;padding:8px">Tagesstunden</th>
            </tr>
          </thead>
          <tbody style="background:#fff;color:#111">
            ${dayRows.join('')}
          </tbody>
        </table>

        <h4 style="margin-top:12px;margin-bottom:6px">📎 Angehängte Dokumente:</h4>
        <ul style="font-size:13px; margin-top:0;">
          <li>Automatisch generierte Abrechnungs-PDF</li>
          ${attachmentListHtml}
        </ul>

        <p style="margin-top:12px">💡 Diese Abrechnung wurde automatisiert über das System Gleistrix erstellt – inklusive Einsatzzeiterfassung, Projektzuordnung und digitalem Export.<br/>Bei Rückfragen zur Abrechnung oder zum Einsatz kontaktieren Sie uns jederzeit.</p>
        <p>Mit freundlichen Grüßen<br/><strong>Die Disposition</strong></p>
      </div>
    `
    // set subject to subjectText
    // (we will use subjectText variable below)

    const emailResult = await sendEmailResult({ to, subject: subjectText, html: emailHtml, attachments: emailAttachments });

    // Log notification
    try {
      await NotificationLog.create({
        key: notifKey,
        to,
        subject: `Abrechnung ${(project as any).name}`,
        success: emailResult.ok,
        errorMessage: emailResult.error,
        projectId: (project as any)._id,
        projectName: (project as any).name,
        attachmentsCount: emailAttachments.length,
        meta: { days: daysFromRows, copyDays: Array.from(copySet), selectedRowKeys, performedBy: (auth as any).token?.email || 'system' }
      })
    } catch (logErr) {
      console.error('Failed to create notification log:', logErr)
    }

    // Update project's billed days and status based on billed billing positions
    try {
      const allRows = normalizeProjectTimeEntriesToBillingRows((project as any).mitarbeiterZeiten || {}, undefined)
      const allPositions: any[] = await BillingPosition.find({ projectId: (project as any)._id }).lean()
      const billedKeys = new Set(allPositions.map((p: any) => String(p.rowKey)))

      const allDays = Array.from(new Set(allRows.map((r) => r.day))).sort()
      const fullyBilledDays = allDays.filter((day) => {
        const dayRows = allRows.filter((r) => r.day === day)
        if (dayRows.length === 0) return false
        return dayRows.every((r) => billedKeys.has(String(r.rowKey)))
      })

      let newStatus = (project as any).status
      if (billedKeys.size > 0 && fullyBilledDays.length < allDays.length) {
        newStatus = 'teilweise_abgerechnet'
      }
      if (allDays.length > 0 && fullyBilledDays.length === allDays.length) {
        newStatus = 'geleistet'
      }

      await Project.findByIdAndUpdate(
        (project as any)._id,
        { $set: { abgerechneteTage: fullyBilledDays, status: newStatus } }
      )

        // Aktivitäten-Logs schreiben
        try {
          const token = (auth as any).token;
          const tokenLogUserId = String(token?.id || '')
          const userId = mongoose.isValidObjectId(tokenLogUserId) ? new mongoose.Types.ObjectId(tokenLogUserId) : undefined;
          // 1) Abrechnung-Log mit Tagen (inkl. Kopie-Tage)
          await ActivityLog.create({
            timestamp: new Date(),
            actionType: fullyBilledDays.length >= allDays.length ? 'billing_full' : 'billing_partial',
            module: 'billing',
            performedBy: {
              userId: userId!,
              name: token?.name || token?.email || 'Unbekannt',
              role: token?.role || 'user'
            },
            details: {
              entityId: (project as any)._id,
              description: `Abrechnung durchgeführt für Projekt "${(project as any).name}" (${daysFromRows.length} Tag(e), ${selectedRows.length} Position(en))`,
              before: { abgerechneteTage: (project as any).abgerechneteTage || [] },
              after: { abgerechneteTage: fullyBilledDays },
              context: {
                days: daysFromRows,
                copyDays: Array.from(copySet),
                selectedRowKeys,
              }
            }
          })

          // 2) Statuswechsel → „geleistet“ ebenfalls loggen
          if (newStatus === 'geleistet' && (project as any).status !== 'geleistet') {
            await ActivityLog.create({
              timestamp: new Date(),
              actionType: 'project_status_changed',
              module: 'project',
              performedBy: {
                userId: userId!,
                name: token?.name || token?.email || 'Unbekannt',
                role: token?.role || 'user'
              },
              details: {
                entityId: (project as any)._id,
                description: `Projektstatus geändert: ${(project as any).name} (${(project as any).status} → geleistet)`,
                before: { status: (project as any).status },
                after: { status: 'geleistet' }
              }
            })
          }
        } catch (logErr) {
          console.warn('ActivityLog for billing/status failed:', logErr)
        }
    } catch (e) {
      console.warn('Could not update project billed days/status', e)
    }

    const firstPdf = pdfBuffers[0]
    return NextResponse.json({
      success: true,
      pdf: firstPdf
        ? {
            filename: firstPdf.filename,
            mimeType: 'application/pdf',
            base64: firstPdf.buffer.toString('base64'),
          }
        : null,
    })
  }catch(e){
    console.error('Abrechnung failed', e)
    return NextResponse.json({ message: 'Fehler bei Abrechnung' }, { status: 500 })
  }
}


