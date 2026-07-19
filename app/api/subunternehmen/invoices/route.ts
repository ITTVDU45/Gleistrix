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
  nextInvoiceSequence,
} from '@/lib/subunternehmen/invoiceValidation'
import { suggestInvoiceNumber } from '@/lib/subunternehmen/invoiceTotals'
import { logSubcontractorActivity } from '@/lib/subunternehmen/audit'
import { logger } from '@/lib/logger'

/** Eigene Rechnungen auflisten. */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireSubcontractor(req, 'subcontractor.invoices.read')
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

    await dbConnect()
    const invoices = await ReceivedInvoice.find({ subcontractorCompanyId: auth.ctx.companyId })
      .sort({ updatedAt: -1 })
      .lean()

    return NextResponse.json({
      success: true,
      invoices: (invoices as Array<Record<string, any>>).map(serializeInvoiceForPortal),
    })
  } catch (error) {
    logger.error('Portal: Rechnungen konnten nicht geladen werden', error)
    return NextResponse.json({ error: 'Fehler beim Laden der Rechnungen' }, { status: 500 })
  }
}

/** Neuen Rechnungsentwurf anlegen (Summen serverseitig). */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireSubcontractor(req, 'subcontractor.invoices.create')
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
    if (!hasValidCsrfIntent(req, 'sub:invoice-create')) {
      return NextResponse.json({ error: 'Ungültige Anforderung' }, { status: 400 })
    }

    await dbConnect()
    const parsed = invoiceDraftSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validierungsfehler', issues: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { ctx } = auth
    const draft = computeDraft(parsed.data, ctx.company.defaultVatRate)

    // Rechnungsnummer: übernehmen oder automatisch die nächste freie Nummer suchen
    let invoiceNumber = parsed.data.invoiceNumber?.trim()
    if (!invoiceNumber) {
      const year = draft.invoiceDate.getFullYear()
      const seq = await nextInvoiceSequence(ctx.companyId, year)
      // Gelöschte Entwürfe können Lücken/Kollisionen erzeugen → freie Nummer suchen
      for (let attempt = 0; attempt < 100; attempt++) {
        const candidate = suggestInvoiceNumber(ctx.company.invoiceNumberPrefix, year, seq + attempt)
        if (!(await isInvoiceNumberTaken(ctx.companyId, candidate))) {
          invoiceNumber = candidate
          break
        }
      }
      if (!invoiceNumber) {
        return NextResponse.json(
          { error: 'Keine freie Rechnungsnummer gefunden – bitte manuell vergeben' },
          { status: 409 }
        )
      }
    } else if (await isInvoiceNumberTaken(ctx.companyId, invoiceNumber)) {
      return NextResponse.json(
        { error: `Rechnungsnummer "${invoiceNumber}" wird bereits verwendet` },
        { status: 409 }
      )
    }

    const validation = await validateLineItemsAgainstAssignments(ctx.companyId, draft.lineItems)
    if (validation.errors.length > 0) {
      return NextResponse.json(
        { error: 'Doppelte oder ungültige Einsätze in den Positionen', details: validation.errors },
        { status: 409 }
      )
    }

    const invoice = await ReceivedInvoice.create({
      subcontractorCompanyId: ctx.companyId,
      createdByUserId: ctx.userId,
      invoiceNumber,
      invoiceDate: draft.invoiceDate,
      servicePeriodStart: draft.servicePeriodStart,
      servicePeriodEnd: draft.servicePeriodEnd,
      projectIds: draft.projectIds
        .filter((p) => mongoose.isValidObjectId(p))
        .map((p) => new mongoose.Types.ObjectId(p)),
      orderNumber: parsed.data.orderNumber,
      purchaseOrderNumber: parsed.data.purchaseOrderNumber,
      lineItems: draft.lineItems,
      subtotalNet: draft.subtotalNet,
      totalVat: draft.totalVat,
      totalGross: draft.totalGross,
      currency: 'EUR',
      paymentTermDays: draft.paymentTermDays ?? ctx.company.defaultPaymentTermDays,
      dueDate: draft.dueDate,
      remarks: parsed.data.remarks,
      status: 'DRAFT',
      warnings: validation.warnings,
      version: 1,
      statusHistory: [
        {
          id: new mongoose.Types.ObjectId().toString(),
          newStatus: 'DRAFT',
          changedByUserId: String(ctx.userId),
          changedByName: ctx.userName,
          changedAt: new Date(),
        },
      ],
    })

    await logSubcontractorActivity({
      actionType: 'subcontractor_invoice_created',
      description: `Rechnungsentwurf erstellt: ${invoiceNumber} (${ctx.companyName})`,
      userId: ctx.userId,
      userName: ctx.userName,
      userRole: 'subunternehmen',
      entityId: invoice._id,
      subcontractorCompanyId: ctx.companyId,
      meta: { invoiceNumber, positions: draft.lineItems.length },
    })

    return NextResponse.json(
      {
        success: true,
        invoice: serializeInvoiceForPortal(invoice.toObject()),
        warnings: validation.warnings,
      },
      { status: 201 }
    )
  } catch (error) {
    logger.error('Portal: Rechnungsentwurf konnte nicht erstellt werden', error)
    return NextResponse.json({ error: 'Fehler beim Erstellen der Rechnung' }, { status: 500 })
  }
}
