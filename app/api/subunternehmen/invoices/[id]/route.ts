import { NextRequest, NextResponse } from 'next/server'
import { hasValidCsrfIntent } from '@/lib/security/requireCsrfIntent'
import mongoose from 'mongoose'
import dbConnect from '@/lib/dbConnect'
import ReceivedInvoice from '@/lib/models/ReceivedInvoice'
import { requireSubcontractor } from '@/lib/subunternehmen/access'
import { serializeInvoiceForPortal } from '@/lib/subunternehmen/serialize'
import { invoiceDraftSchema, computeDraft } from '@/lib/subunternehmen/invoiceDraft'
import {
  validateLineItemsAgainstAssignments,
  isInvoiceNumberTaken,
} from '@/lib/subunternehmen/invoiceValidation'
import {
  isEditableBySubcontractor,
  isDeletableBySubcontractor,
} from '@/lib/subunternehmen/invoiceStatus'
import { logSubcontractorActivity } from '@/lib/subunternehmen/audit'
import { logger } from '@/lib/logger'

/** Lädt eine Rechnung ausschließlich im Scope des eigenen Subunternehmens. */
async function findOwnInvoice(id: string, companyId: mongoose.Types.ObjectId) {
  if (!mongoose.isValidObjectId(id)) return null
  return ReceivedInvoice.findOne({ _id: id, subcontractorCompanyId: companyId })
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireSubcontractor(req, 'subcontractor.invoices.read')
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

    await dbConnect()
    const { id } = await params
    const invoice = await findOwnInvoice(id, auth.ctx.companyId)
    if (!invoice) return NextResponse.json({ error: 'Rechnung nicht gefunden' }, { status: 404 })

    return NextResponse.json({ success: true, invoice: serializeInvoiceForPortal(invoice.toObject()) })
  } catch (error) {
    logger.error('Portal: Rechnung konnte nicht geladen werden', error)
    return NextResponse.json({ error: 'Fehler beim Laden der Rechnung' }, { status: 500 })
  }
}

/** Entwurf aktualisieren – nur DRAFT, Summen serverseitig. */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireSubcontractor(req, 'subcontractor.invoices.create')
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
    if (!hasValidCsrfIntent(req, 'sub:invoice-update')) {
      return NextResponse.json({ error: 'Ungültige Anforderung' }, { status: 400 })
    }

    await dbConnect()
    const { id } = await params
    const invoice = await findOwnInvoice(id, auth.ctx.companyId)
    if (!invoice) return NextResponse.json({ error: 'Rechnung nicht gefunden' }, { status: 404 })

    if (!isEditableBySubcontractor(invoice.status)) {
      return NextResponse.json(
        { error: 'Nur Entwürfe können bearbeitet werden. Nutzen Sie bei Rückfragen die Revision.' },
        { status: 409 }
      )
    }

    const parsed = invoiceDraftSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validierungsfehler', issues: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { ctx } = auth
    const draft = computeDraft(parsed.data, ctx.company.defaultVatRate)

    const invoiceNumber = parsed.data.invoiceNumber?.trim() || invoice.invoiceNumber
    if (await isInvoiceNumberTaken(ctx.companyId, invoiceNumber, id)) {
      return NextResponse.json(
        { error: `Rechnungsnummer "${invoiceNumber}" wird bereits verwendet` },
        { status: 409 }
      )
    }

    const validation = await validateLineItemsAgainstAssignments(ctx.companyId, draft.lineItems, id)
    if (validation.errors.length > 0) {
      return NextResponse.json(
        { error: 'Doppelte oder ungültige Einsätze in den Positionen', details: validation.errors },
        { status: 409 }
      )
    }

    invoice.invoiceNumber = invoiceNumber
    invoice.invoiceDate = draft.invoiceDate
    invoice.servicePeriodStart = draft.servicePeriodStart
    invoice.servicePeriodEnd = draft.servicePeriodEnd
    invoice.projectIds = draft.projectIds
      .filter((p) => mongoose.isValidObjectId(p))
      .map((p) => new mongoose.Types.ObjectId(p))
    invoice.orderNumber = parsed.data.orderNumber
    invoice.purchaseOrderNumber = parsed.data.purchaseOrderNumber
    invoice.lineItems = draft.lineItems
    invoice.subtotalNet = draft.subtotalNet
    invoice.totalVat = draft.totalVat
    invoice.totalGross = draft.totalGross
    invoice.paymentTermDays = draft.paymentTermDays ?? invoice.paymentTermDays
    invoice.dueDate = draft.dueDate
    invoice.remarks = parsed.data.remarks
    invoice.warnings = validation.warnings
    await invoice.save()

    await logSubcontractorActivity({
      actionType: 'subcontractor_invoice_updated',
      description: `Rechnungsentwurf bearbeitet: ${invoiceNumber} (${ctx.companyName})`,
      userId: ctx.userId,
      userName: ctx.userName,
      userRole: 'subunternehmen',
      entityId: invoice._id,
      subcontractorCompanyId: ctx.companyId,
    })

    return NextResponse.json({
      success: true,
      invoice: serializeInvoiceForPortal(invoice.toObject()),
      warnings: validation.warnings,
    })
  } catch (error) {
    logger.error('Portal: Rechnung konnte nicht gespeichert werden', error)
    return NextResponse.json({ error: 'Fehler beim Speichern der Rechnung' }, { status: 500 })
  }
}

/** Entwurf löschen – nur DRAFT. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireSubcontractor(req, 'subcontractor.invoices.create')
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
    if (!hasValidCsrfIntent(req, 'sub:invoice-delete')) {
      return NextResponse.json({ error: 'Ungültige Anforderung' }, { status: 400 })
    }

    await dbConnect()
    const { id } = await params
    const invoice = await findOwnInvoice(id, auth.ctx.companyId)
    if (!invoice) return NextResponse.json({ error: 'Rechnung nicht gefunden' }, { status: 404 })

    if (!isDeletableBySubcontractor(invoice.status)) {
      return NextResponse.json({ error: 'Nur Entwürfe können gelöscht werden' }, { status: 409 })
    }

    await invoice.deleteOne()

    await logSubcontractorActivity({
      actionType: 'subcontractor_invoice_updated',
      description: `Rechnungsentwurf gelöscht: ${invoice.invoiceNumber} (${auth.ctx.companyName})`,
      userId: auth.ctx.userId,
      userName: auth.ctx.userName,
      userRole: 'subunternehmen',
      entityId: invoice._id,
      subcontractorCompanyId: auth.ctx.companyId,
    })

    return NextResponse.json({ success: true, message: 'Entwurf gelöscht' })
  } catch (error) {
    logger.error('Portal: Rechnung konnte nicht gelöscht werden', error)
    return NextResponse.json({ error: 'Fehler beim Löschen der Rechnung' }, { status: 500 })
  }
}
