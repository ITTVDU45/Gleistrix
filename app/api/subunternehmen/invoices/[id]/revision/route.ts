import { NextRequest, NextResponse } from 'next/server'
import { hasValidCsrfIntent } from '@/lib/security/requireCsrfIntent'
import mongoose from 'mongoose'
import dbConnect from '@/lib/dbConnect'
import ReceivedInvoice from '@/lib/models/ReceivedInvoice'
import { requireSubcontractor } from '@/lib/subunternehmen/access'
import { serializeInvoiceForPortal } from '@/lib/subunternehmen/serialize'
import { canTransition } from '@/lib/subunternehmen/invoiceStatus'
import { logSubcontractorActivity } from '@/lib/subunternehmen/audit'
import { logger } from '@/lib/logger'

/**
 * Revision nach Rückfrage: Rechnung geht mit erhöhter Versionsnummer zurück in
 * den Entwurf. Die Statushistorie dokumentiert den Vorgang vollständig –
 * ein stilles Verändern eingereichter Rechnungen ist damit ausgeschlossen.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireSubcontractor(req, 'subcontractor.invoices.create')
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
    if (!hasValidCsrfIntent(req, 'sub:invoice-revision')) {
      return NextResponse.json({ error: 'Ungültige Anforderung' }, { status: 400 })
    }

    await dbConnect()
    const { id } = await params
    const { ctx } = auth

    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json({ error: 'Rechnung nicht gefunden' }, { status: 404 })
    }
    const invoice = await ReceivedInvoice.findOne({ _id: id, subcontractorCompanyId: ctx.companyId })
    if (!invoice) return NextResponse.json({ error: 'Rechnung nicht gefunden' }, { status: 404 })

    if (!canTransition(invoice.status, 'DRAFT', 'subcontractor')) {
      return NextResponse.json(
        { error: 'Eine Revision ist nur bei Rückfragen (Status „Rückfrage“) möglich' },
        { status: 409 }
      )
    }

    const previousStatus = invoice.status
    invoice.status = 'DRAFT'
    invoice.version = (invoice.version || 1) + 1
    invoice.statusHistory.push({
      id: new mongoose.Types.ObjectId().toString(),
      previousStatus,
      newStatus: 'DRAFT',
      message: `Revision ${invoice.version} erstellt`,
      changedByUserId: String(ctx.userId),
      changedByName: ctx.userName,
      changedAt: new Date(),
    })
    await invoice.save()

    await logSubcontractorActivity({
      actionType: 'subcontractor_invoice_updated',
      description: `Revision erstellt: ${invoice.invoiceNumber} → Version ${invoice.version} (${ctx.companyName})`,
      userId: ctx.userId,
      userName: ctx.userName,
      userRole: 'subunternehmen',
      entityId: invoice._id,
      subcontractorCompanyId: ctx.companyId,
    })

    return NextResponse.json({ success: true, invoice: serializeInvoiceForPortal(invoice.toObject()) })
  } catch (error) {
    logger.error('Portal: Revision konnte nicht erstellt werden', error)
    return NextResponse.json({ error: 'Fehler beim Erstellen der Revision' }, { status: 500 })
  }
}
