import { NextRequest, NextResponse } from 'next/server'
import dbConnect from '@/lib/dbConnect'
import { requireSubcontractor } from '@/lib/subunternehmen/access'
import {
  findProjectsForCompany,
  getInvoicedKeysForCompany,
  todayIsoDate,
} from '@/lib/subunternehmen/queries'
import { sanitizeProjectForSubcontractor } from '@/lib/subunternehmen/sanitizeProject'
import { logger } from '@/lib/logger'

/** Meine Projekte – nur Projekte mit eigener Disposition, whitelist-sanitisiert. */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireSubcontractor(req, 'subcontractor.projects.read')
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

    await dbConnect()
    const { ctx } = auth
    const [projects, invoiced] = await Promise.all([
      findProjectsForCompany(ctx.companyId),
      getInvoicedKeysForCompany(ctx.companyId),
    ])
    const today = todayIsoDate()

    const sanitized = projects
      .map((p) =>
        sanitizeProjectForSubcontractor(p, String(ctx.companyId), {
          today,
          invoicedKeys: invoiced.invoicedKeys,
          invoiceNumbersByKey: invoiced.invoiceNumbersByKey,
        })
      )
      .sort((a, b) => (b.datumBeginn || '').localeCompare(a.datumBeginn || ''))

    // Übersichts-Projektion ohne die einzelnen Einsätze (schlanker Payload)
    const list = sanitized.map((p) => ({
      id: p.id,
      name: p.name,
      projectNumber: p.projectNumber,
      baustelle: p.baustelle,
      datumBeginn: p.datumBeginn,
      datumEnde: p.datumEnde,
      status: p.status,
      einsatzCount: p.sums.einsaetze,
      mitarbeiterCount: p.sums.mitarbeiter,
      stundenGeplant: p.einsaetze.filter((e) => e.status === 'geplant').reduce((s, e) => s + e.stundenTotal, 0),
      stundenBestaetigt: p.einsaetze.filter((e) => e.status !== 'geplant').reduce((s, e) => s + e.stundenTotal, 0),
      billableCount: p.billableCount,
    }))

    return NextResponse.json({ success: true, projects: list })
  } catch (error) {
    logger.error('Portal: Projekte konnten nicht geladen werden', error)
    return NextResponse.json({ error: 'Fehler beim Laden der Projekte' }, { status: 500 })
  }
}
