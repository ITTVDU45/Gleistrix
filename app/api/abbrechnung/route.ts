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
    if (!projectId) return NextResponse.json({ message: 'projectId fehlt' }, { status: 400 })

    const project = await Project.findById(projectId).lean()
    if (!project) return NextResponse.json({ message: 'Projekt nicht gefunden' }, { status: 404 })

    // Erzeuge PDF(s) via helper (wird in lib/pdfExport erwartet)
    const pdfBuffers: Array<{ filename: string; buffer: Buffer }> = []
    try {
      console.debug('Abrechnung request', { projectId, days: Array.isArray(days) ? days.length : 0, copyDays: Array.isArray(copyDays) ? copyDays.length : 0 })
      if (typeof createPDFForProjectDays === 'function'){
        const buf = await createPDFForProjectDays(project as any, days)
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
    const to = isEnabled ? (cfg.to || (DEFAULT_NOTIFICATION_DEFS as any)[notifKey].defaultConfig.to) : (process.env.ABBRECHNUNG_EMAIL || process.env.EMAIL_FROM || 'admin@example.com');

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

    // Compose informative email body: number of selected days, unique employees, total hours
    let totalHours = 0
    const uniqueEmployees = new Set<string>()
    try {
      const timesAny: any = project.mitarbeiterZeiten || {}
      for (const d of (days || [])) {
        const entries = timesAny?.[d] || []
        for (const e of entries) {
          if (typeof e.stunden === 'number') totalHours += e.stunden
          if (e.name) uniqueEmployees.add(e.name)
        }
      }
    } catch (e) {}

    // Build detailed HTML with per-day breakdown
    const timesAny: any = project.mitarbeiterZeiten || {}
    const copySet = new Set(Array.isArray(copyDays) ? copyDays : [])
    const dayRows: string[] = []
    for (const d of (days || [])) {
      const entries = timesAny?.[d] || []
      const perEmp: Record<string, number> = {}
      let dayTotal = 0
      for (const e of entries) {
        const name = e.name || 'Unbekannt'
        const hrs = typeof e.stunden === 'number' ? e.stunden : parseFloat(e.stunden || 0) || 0
        dayTotal += hrs
        perEmp[name] = (perEmp[name] || 0) + hrs
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

    const subjectText = `Abrechnung für Projekt „${project.name}“ – Mülheimer Wachdienst GmbH Zeiterfassung${copySet.size>0 ? ' (enthält Kopien bereits abgerechneter Tage)' : ''}`

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; color: #111;">
        ${logoHtml}
        <h2 style="font-size:18px;margin-bottom:6px">Abrechnung für Projekt „${project.name}“ – Mülheimer Wachdienst GmbH Zeiterfassung</h2>
        <p>Sehr geehrte Damen und Herren,</p>
        <p>für das Projekt „<strong>${project.name}</strong>“ wurde auf Basis der durch das System Gleistrix - Mülheimerwachdienst GmbH erfassten Einsatzzeiten eine Abrechnung generiert. Nachfolgend finden Sie eine detaillierte Übersicht der geleisteten Stunden und eingesetzten Mitarbeitenden:</p>
        <h4 style="margin-bottom:6px">🔎 Projektübersicht:</h4>
        <ul style="margin-top:0;margin-bottom:8px;font-size:13px">
          <li><strong>Projektname:</strong> ${project.name}</li>
          <li><strong>Erfasste Tage:</strong> ${(days || []).length}</li>
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
        subject: `Abrechnung ${project.name}`,
        success: emailResult.ok,
        errorMessage: emailResult.error,
        projectId: project._id,
        projectName: project.name,
        attachmentsCount: emailAttachments.length,
        meta: { days: days || [], copyDays: Array.from(copySet), performedBy: (auth as any).token?.email || 'system' }
      })
    } catch (logErr) {
      console.error('Failed to create notification log:', logErr)
    }

    // Update project's billed days and status
    try {
      if (Array.isArray(days) && days.length > 0) {
        const existing: string[] = Array.isArray((project as any).abgerechneteTage) ? (project as any).abgerechneteTage : []
        const merged = Array.from(new Set([...(existing || []), ...days]))
        
        // Alle Tage mit Einträgen UND die Folgetage bei tagübergreifenden Einträgen
        const allDaysSet = new Set<string>()
        
        // Zuerst Tage mit Einträgen sammeln
        Object.entries((project as any).mitarbeiterZeiten || {}).forEach(([day, arr]: any) => {
          if (Array.isArray(arr) && arr.length > 0) {
            allDaysSet.add(day)
            
            // Dann Folgetage für tagübergreifende Einträge
            for (const e of arr) {
              const endStr = e?.ende || e?.end
              if (typeof endStr === 'string' && endStr.includes('T')) {
                const endDay = endStr.slice(0,10)
                if (endDay && endDay !== day) {
                  allDaysSet.add(endDay)
                }
              }
            }
          }
        })
        
        const allDays = Array.from(allDaysSet)
        console.log('Projektstatus-Berechnung:', {
          projektId: project._id,
          allDays,
          merged,
          allDaysLength: allDays.length,
          mergedLength: merged.length,
          isComplete: allDays.length > 0 && merged.length >= allDays.length
        })
        
        let newStatus = (project as any).status
        if (merged.length > 0 && allDays.length > 0 && merged.length < allDays.length) {
          newStatus = 'teilweise_abgerechnet'
        }
        if (allDays.length > 0 && merged.length >= allDays.length) {
          newStatus = 'geleistet'
        }
        
        console.log('Setze neuen Status:', newStatus)
        await Project.findByIdAndUpdate(project._id, { $set: { abgerechneteTage: merged, status: newStatus } })

        // Aktivitäten-Logs schreiben
        try {
          const token = (auth as any).token;
          const userId = token?.id ? new mongoose.Types.ObjectId(String(token.id)) : undefined;
          // 1) Abrechnung-Log mit Tagen (inkl. Kopie-Tage)
          await ActivityLog.create({
            timestamp: new Date(),
            actionType: merged.length >= allDays.length ? 'billing_full' : 'billing_partial',
            module: 'billing',
            performedBy: {
              userId: userId!,
              name: token?.name || token?.email || 'Unbekannt',
              role: token?.role || 'user'
            },
            details: {
              entityId: project._id,
              description: `Abrechnung durchgeführt für Projekt "${project.name}" (${days.length} Tag(e))`,
              before: { abgerechneteTage: existing },
              after: { abgerechneteTage: merged },
              context: {
                days: Array.isArray(days) ? days : [],
                copyDays: Array.from(copySet),
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
                entityId: project._id,
                description: `Projektstatus geändert: ${project.name} (${(project as any).status} → geleistet)`,
                before: { status: (project as any).status },
                after: { status: 'geleistet' }
              }
            })
          }
        } catch (logErr) {
          console.warn('ActivityLog for billing/status failed:', logErr)
        }
      }
    } catch (e) {
      console.warn('Could not update project billed days/status', e)
    }

    return NextResponse.json({ success: true })
  }catch(e){
    console.error('Abrechnung failed', e)
    return NextResponse.json({ message: 'Fehler bei Abrechnung' }, { status: 500 })
  }
}


