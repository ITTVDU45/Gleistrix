import { NextRequest, NextResponse } from 'next/server'
import dbConnect from '@/lib/dbConnect'
import { requireSubcontractor } from '@/lib/subunternehmen/access'
import {
  findProjectForCompany,
  getInvoicedKeysForCompany,
  todayIsoDate,
} from '@/lib/subunternehmen/queries'
import { sanitizeProjectForSubcontractor } from '@/lib/subunternehmen/sanitizeProject'
import { logger } from '@/lib/logger'

/** Projektdetail – nur freigegebene Felder + eigene Einsätze. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireSubcontractor(req, 'subcontractor.projects.read')
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

    await dbConnect()
    const { id } = await params
    const { ctx } = auth

    const project = await findProjectForCompany(id, ctx.companyId)
    if (!project) {
      // Bewusst 404 statt 403: keine Information über fremde Projekte preisgeben
      return NextResponse.json({ error: 'Projekt nicht gefunden' }, { status: 404 })
    }

    const invoiced = await getInvoicedKeysForCompany(ctx.companyId)
    const sanitized = sanitizeProjectForSubcontractor(project, String(ctx.companyId), {
      today: todayIsoDate(),
      invoicedKeys: invoiced.invoicedKeys,
      invoiceNumbersByKey: invoiced.invoiceNumbersByKey,
    })

    return NextResponse.json({ success: true, project: sanitized })
  } catch (error) {
    logger.error('Portal: Projektdetail konnte nicht geladen werden', error)
    return NextResponse.json({ error: 'Fehler beim Laden des Projekts' }, { status: 500 })
  }
}
