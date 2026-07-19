import { NextRequest, NextResponse } from 'next/server'
import dbConnect from '@/lib/dbConnect'
import { requireSubcontractor } from '@/lib/subunternehmen/access'
import {
  findProjectsForCompany,
  getInvoicedKeysForCompany,
  todayIsoDate,
} from '@/lib/subunternehmen/queries'
import { toSubcontractorAssignments, sumAssignments } from '@/lib/subunternehmen/assignments'
import { logger } from '@/lib/logger'

/** Alle Einsätze des Subunternehmens über alle Projekte (Filter clientseitig). */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireSubcontractor(req, 'subcontractor.assignments.read')
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

    await dbConnect()
    const { ctx } = auth
    const [projects, invoiced] = await Promise.all([
      findProjectsForCompany(ctx.companyId),
      getInvoicedKeysForCompany(ctx.companyId),
    ])
    const today = todayIsoDate()

    const assignments = projects
      .flatMap((p) =>
        toSubcontractorAssignments(p, String(ctx.companyId), {
          today,
          invoicedKeys: invoiced.invoicedKeys,
          invoiceNumbersByKey: invoiced.invoiceNumbersByKey,
        })
      )
      .sort((a, b) => b.day.localeCompare(a.day))

    return NextResponse.json({
      success: true,
      assignments,
      sums: sumAssignments(assignments),
    })
  } catch (error) {
    logger.error('Portal: Einsätze konnten nicht geladen werden', error)
    return NextResponse.json({ error: 'Fehler beim Laden der Einsätze' }, { status: 500 })
  }
}
