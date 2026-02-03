import { NextRequest, NextResponse } from 'next/server'
import dbConnect from '@/lib/dbConnect'
import { Maintenance } from '@/lib/models/Maintenance'
import { requireAuth } from '@/lib/security/requireAuth'
import { createMaintenanceReportPDF, type MaintenanceReportEntry } from '@/lib/pdfExportLager'
import mongoose from 'mongoose'

export async function GET(request: NextRequest) {
  try {
    await dbConnect()
    const auth = await requireAuth(request, ['user', 'admin', 'superadmin'])
    if (!auth.ok) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status })
    }
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') ?? undefined
    const von = searchParams.get('von') ?? undefined
    const bis = searchParams.get('bis') ?? undefined

    const filter: Record<string, unknown> = {}
    if (status) filter.status = status
    if (von || bis) {
      filter.faelligkeitsdatum = {}
      if (von) (filter.faelligkeitsdatum as Record<string, Date>).$gte = new Date(von)
      if (bis) (filter.faelligkeitsdatum as Record<string, Date>).$lte = new Date(bis)
    }

    const list = await Maintenance.find(filter)
      .sort({ faelligkeitsdatum: 1 })
      .limit(500)
      .populate('artikelId', 'bezeichnung artikelnummer')
      .lean()

    const entries: MaintenanceReportEntry[] = list.map((doc: unknown) => {
      const d = doc as Record<string, unknown>
      return {
        artikelId: d.artikelId,
        wartungsart: (d.wartungsart as string) ?? '',
        faelligkeitsdatum: (d.faelligkeitsdatum as Date) ?? '',
        durchfuehrungsdatum: (d.durchfuehrungsdatum as Date | null) ?? null,
        status: (d.status as string) ?? '',
        ergebnis: (d.ergebnis as string) ?? ''
      }
    })

    const buffer = await createMaintenanceReportPDF(entries)
    const dateStr = new Date().toISOString().slice(0, 10)
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Wartungsbericht-${dateStr}.pdf"`
      }
    })
  } catch (error) {
    console.error('Fehler beim Erstellen des Wartungsbericht-PDF:', error)
    return NextResponse.json(
      { success: false, message: 'Fehler beim Erstellen des PDF' },
      { status: 500 }
    )
  }
}
