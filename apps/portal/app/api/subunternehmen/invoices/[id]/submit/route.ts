import { NextRequest, NextResponse } from 'next/server'
import { hasValidCsrfIntent } from '@/lib/security/requireCsrfIntent'
import mongoose from 'mongoose'
import dbConnect from '@/lib/dbConnect'
import ReceivedInvoice from '@/lib/models/ReceivedInvoice'
import SubcontractorDocument from '@/lib/models/SubcontractorDocument'
import NotificationLog from '@/lib/models/NotificationLog'
import { Project } from '@/lib/models/Project'
import { requireSubcontractor } from '@/lib/subunternehmen/access'
import { serializeInvoiceForPortal } from '@/lib/subunternehmen/serialize'
import { canTransition } from '@/lib/subunternehmen/invoiceStatus'
import { validateLineItemsAgainstAssignments } from '@/lib/subunternehmen/invoiceValidation'
import { missingCompanyFieldsForInvoicing } from '@/lib/subunternehmen/queries'
import { createInvoicePdf, type InvoicePdfCompany } from '@/lib/subunternehmen/invoicePdf'
import minioClient, {
  bucketExistsAsync,
  makeBucketAsync,
  getReceivedInvoiceObjectKey,
} from '@/lib/storage/minioClient'
import { sendEmailResult } from '@/lib/mailer'
import { logSubcontractorActivity } from '@/lib/subunternehmen/audit'
import { logger } from '@/lib/logger'

/**
 * Rechnung digital einreichen: validieren → unveränderbare PDF erzeugen →
 * in MinIO ablegen → Status SUBMITTED → interne Benachrichtigung.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireSubcontractor(req, 'subcontractor.invoices.submit')
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
    if (!hasValidCsrfIntent(req, 'sub:invoice-submit')) {
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

    if (!canTransition(invoice.status, 'SUBMITTED', 'subcontractor')) {
      return NextResponse.json(
        { error: `Rechnung im Status "${invoice.status}" kann nicht eingereicht werden` },
        { status: 409 }
      )
    }

    if (invoice.lineItems.length === 0) {
      return NextResponse.json({ error: 'Die Rechnung enthält keine Positionen' }, { status: 400 })
    }

    // Pflichtangaben des Unternehmens (spätestens vor dem Einreichen)
    const missing = missingCompanyFieldsForInvoicing(ctx.company)
    if (missing.length > 0) {
      return NextResponse.json(
        {
          error: `Bitte vervollständigen Sie zuerst Ihre Stammdaten: ${missing.join(', ')}`,
          missingFields: missing,
        },
        { status: 422 }
      )
    }

    // Einsätze final validieren (Doppelabrechnung hart blockieren)
    const validation = await validateLineItemsAgainstAssignments(ctx.companyId, invoice.lineItems, id)
    if (validation.errors.length > 0) {
      return NextResponse.json(
        { error: 'Die Rechnung enthält doppelt abgerechnete oder ungültige Einsätze', details: validation.errors },
        { status: 409 }
      )
    }

    // Projektbezeichnungen für die PDF
    const projects = invoice.projectIds.length
      ? await Project.find({ _id: { $in: invoice.projectIds } }).select('name auftragsnummer').lean()
      : []
    const projectLabels = (projects as Array<{ name?: string; auftragsnummer?: string }>).map(
      (p) => `${p.auftragsnummer || ''} ${p.name || ''}`.trim()
    )

    // Unveränderbare PDF erzeugen und in MinIO ablegen
    const pdfBuffer = createInvoicePdf(invoice, ctx.company as InvoicePdfCompany, projectLabels)
    const bucket = process.env.MINIO_BUCKET || 'project-documents'
    try {
      if (!process.env.MINIO_BUCKET) {
        const exists = await bucketExistsAsync(bucket)
        if (!exists) await makeBucketAsync(bucket)
      }
      const filename = `Rechnung-${invoice.invoiceNumber}-v${invoice.version}.pdf`
      const objectKey = getReceivedInvoiceObjectKey(String(ctx.companyId), String(invoice._id), filename)
      await minioClient.putObject(bucket, objectKey, pdfBuffer, pdfBuffer.length, {
        'Content-Type': 'application/pdf',
      })

      const pdfDoc = await SubcontractorDocument.create({
        subcontractorCompanyId: ctx.companyId,
        invoiceId: invoice._id,
        type: 'INVOICE_PDF',
        name: filename,
        bucket,
        objectKey,
        contentType: 'application/pdf',
        size: pdfBuffer.length,
        uploadedByUserId: ctx.userId,
        uploadedByName: ctx.userName,
        source: 'subcontractor',
      })
      invoice.generatedPdfDocumentId = pdfDoc._id
    } catch (storageError) {
      logger.error('Portal: Rechnungs-PDF konnte nicht gespeichert werden', storageError)
      return NextResponse.json(
        { error: 'Rechnungs-PDF konnte nicht gespeichert werden. Bitte später erneut versuchen.' },
        { status: 500 }
      )
    }

    const previousStatus = invoice.status
    invoice.status = 'SUBMITTED'
    invoice.submittedAt = new Date()
    invoice.warnings = validation.warnings
    invoice.statusHistory.push({
      id: new mongoose.Types.ObjectId().toString(),
      previousStatus,
      newStatus: 'SUBMITTED',
      changedByUserId: String(ctx.userId),
      changedByName: ctx.userName,
      changedAt: new Date(),
    })
    await invoice.save()

    await logSubcontractorActivity({
      actionType: 'subcontractor_invoice_submitted',
      description: `Rechnung eingereicht: ${invoice.invoiceNumber} (${ctx.companyName})`,
      userId: ctx.userId,
      userName: ctx.userName,
      userRole: 'subunternehmen',
      entityId: invoice._id,
      subcontractorCompanyId: ctx.companyId,
      meta: { invoiceNumber: invoice.invoiceNumber, version: invoice.version },
    })

    // Interne Benachrichtigung (Buchhaltung) – best effort
    try {
      const to =
        process.env.RECEIVED_INVOICES_EMAIL ||
        process.env.ABBRECHNUNG_EMAIL ||
        'Buchhaltung@mulheimerwachdienst.de'
      const subject = `Neue Subunternehmen-Rechnung ${invoice.invoiceNumber} von ${ctx.companyName}`
      const emailResult = await sendEmailResult({
        to,
        subject,
        html: `
          <div style="font-family: Arial, sans-serif; color: #111;">
            <h2 style="font-size:17px">Neue Rechnung im Portal eingereicht</h2>
            <p><strong>${ctx.companyName}</strong> hat die Rechnung <strong>${invoice.invoiceNumber}</strong> digital eingereicht.</p>
            <ul style="font-size:13px">
              <li>Bruttobetrag: ${invoice.totalGross.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</li>
              <li>Positionen: ${invoice.lineItems.length}</li>
              <li>Projekte: ${projectLabels.join(', ') || '–'}</li>
            </ul>
            <p>Die Prüfung erfolgt unter <em>Abrechnung → Erhaltene Rechnungen</em>.</p>
          </div>
        `,
        attachments: [
          {
            filename: `Rechnung-${invoice.invoiceNumber}.pdf`,
            content: pdfBuffer,
            contentType: 'application/pdf',
          },
        ],
      })
      await NotificationLog.create({
        key: 'Subunternehmen-Rechnung eingereicht',
        to,
        subject,
        success: emailResult.ok,
        errorMessage: emailResult.error,
        attachmentsCount: 1,
        meta: { invoiceId: String(invoice._id), invoiceNumber: invoice.invoiceNumber, companyId: String(ctx.companyId) },
      })
    } catch (notifyError) {
      logger.warn('Portal: Benachrichtigung über eingereichte Rechnung fehlgeschlagen', notifyError)
    }

    return NextResponse.json({
      success: true,
      invoice: serializeInvoiceForPortal(invoice.toObject()),
    })
  } catch (error) {
    logger.error('Portal: Rechnung konnte nicht eingereicht werden', error)
    return NextResponse.json({ error: 'Fehler beim Einreichen der Rechnung' }, { status: 500 })
  }
}
