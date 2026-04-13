import { NextRequest, NextResponse } from 'next/server'
import dbConnect from '@/lib/dbConnect'
import { Project } from '@/lib/models/Project'
import BillingPosition from '@/lib/models/BillingPosition'
import { requireAuth } from '@/lib/security/requireAuth'
import { normalizeProjectTimeEntriesToBillingRows } from '@/lib/timeEntry/billingRows'

export async function GET(req: NextRequest) {
  try {
    await dbConnect()
    const auth = await requireAuth(req as any, ['user', 'admin', 'superadmin'])
    if (!auth.ok) return NextResponse.json({ message: auth.error }, { status: auth.status })

    const { searchParams } = new URL(req.url)
    const projectId = searchParams.get('projectId')
    const daysRaw = searchParams.get('days') || ''
    const days = daysRaw
      .split(',')
      .map((d) => d.trim())
      .filter(Boolean)

    if (!projectId) {
      return NextResponse.json({ message: 'projectId fehlt' }, { status: 400 })
    }

    const project: any = await Project.findById(projectId).lean()
    if (!project) {
      return NextResponse.json({ message: 'Projekt nicht gefunden' }, { status: 404 })
    }

    const rows = normalizeProjectTimeEntriesToBillingRows(project.mitarbeiterZeiten || {}, days)
    const rowKeys = rows.map((r) => r.rowKey)

    const billedDocs: any[] = rowKeys.length > 0
      ? await BillingPosition.find({ projectId, rowKey: { $in: rowKeys } }).lean()
      : []

    const billedMap = new Map<string, any>()
    billedDocs.forEach((doc: any) => {
      if (!billedMap.has(String(doc.rowKey))) {
        billedMap.set(String(doc.rowKey), doc)
      }
    })

    const positions = rows.map((row) => {
      const billed = billedMap.get(row.rowKey)
      return {
        ...row,
        id: row.rowKey,
        isBilled: Boolean(billed),
        billingStatus: billed?.status || null,
        billedAt: billed?.billedAt || null,
      }
    })

    return NextResponse.json({ success: true, positions })
  } catch (error) {
    console.error('Fehler beim Laden der Abrechnungspositionen:', error)
    return NextResponse.json({ message: 'Fehler beim Laden der Abrechnungspositionen' }, { status: 500 })
  }
}
