import { NextRequest, NextResponse } from 'next/server'
import { hasValidCsrfIntent } from '@/lib/security/requireCsrfIntent'
import mongoose from 'mongoose'
import { z } from 'zod'
import dbConnect from '@/lib/dbConnect'
import ReceivedInvoice from '@/lib/models/ReceivedInvoice'
import NotificationLog from '@/lib/models/NotificationLog'
import { Subcompany } from '@/lib/models/Subcompany'
import User from '@/lib/models/User'
import { requireAdminUser } from '@/lib/auth/requireAdminUser'
import { isFeatureEnabled } from '@/lib/featureFlags'
import { canTransition, requiresMessage, STATUS_LABELS } from '@/lib/subunternehmen/invoiceStatus'
import { serializeInvoiceForAdmin } from '@/lib/subunternehmen/serialize'
import { logSubcontractorActivity } from '@/lib/subunternehmen/audit'
import { sendEmailResult } from '@/lib/mailer'
import { logger } from '@/lib/logger'
import type { ReceivedInvoiceStatus } from '@/types/subunternehmen'

const actionSchema = z.object({
  action: z.enum(['START_REVIEW', 'REQUEST_CHANGES', 'REJECT', 'APPROVE', 'SCHEDULE_PAYMENT', 'MARK_PAID']),
  message: z.string().max(2000).optional(),
})

const ACTION_TO_STATUS: Record<string, ReceivedInvoiceStatus> = {
  START_REVIEW: 'UNDER_REVIEW',
  REQUEST_CHANGES: 'CHANGES_REQUESTED',
  REJECT: 'REJECTED',
  APPROVE: 'APPROVED',
  SCHEDULE_PAYMENT: 'SCHEDULED_FOR_PAYMENT',
  MARK_PAID: 'PAID',
}

const ACTION_TO_AUDIT: Record<string, string> = {
  START_REVIEW: 'subcontractor_invoice_review_started',
  REQUEST_CHANGES: 'subcontractor_invoice_change_requested',
  REJECT: 'subcontractor_invoice_rejected',
  APPROVE: 'subcontractor_invoice_approved',
  SCHEDULE_PAYMENT: 'subcontractor_invoice_status_changed',
  MARK_PAID: 'subcontractor_invoice_paid',
}

/** Interner Statuswechsel einer erhaltenen Rechnung (Prüfworkflow). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const adminAuth = await requireAdminUser(req)
    if (!adminAuth.ok) {
      return NextResponse.json({ error: adminAuth.error }, { status: adminAuth.status })
    }
    if (!hasValidCsrfIntent(req, 'received-invoices:status')) {
      return NextResponse.json({ error: 'Ungültige Anforderung' }, { status: 400 })
    }
    if (!(await isFeatureEnabled('receivedInvoicesEnabled'))) {
      return NextResponse.json({ error: 'Erhaltene Rechnungen sind deaktiviert' }, { status: 403 })
    }

    await dbConnect()
    const { id } = await params
    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json({ error: 'Rechnung nicht gefunden' }, { status: 404 })
    }

    const parsed = actionSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validierungsfehler', issues: parsed.error.flatten() }, { status: 400 })
    }
    const { action } = parsed.data
    const message = parsed.data.message?.trim()
    const targetStatus = ACTION_TO_STATUS[action]

    const invoice = await ReceivedInvoice.findById(id)
    if (!invoice || invoice.status === 'DRAFT') {
      return NextResponse.json({ error: 'Rechnung nicht gefunden' }, { status: 404 })
    }

    if (!canTransition(invoice.status, targetStatus, 'internal')) {
      return NextResponse.json(
        {
          error: `Statuswechsel von "${STATUS_LABELS[invoice.status as ReceivedInvoiceStatus]}" nach "${STATUS_LABELS[targetStatus]}" ist nicht zulässig`,
        },
        { status: 409 }
      )
    }

    if (requiresMessage(targetStatus) && !message) {
      return NextResponse.json(
        {
          error:
            targetStatus === 'CHANGES_REQUESTED'
              ? 'Eine Rückfrage benötigt einen Kommentar'
              : 'Eine Ablehnung muss begründet werden',
        },
        { status: 400 }
      )
    }

    const previousStatus = invoice.status
    const now = new Date()
    invoice.status = targetStatus
    const adminUserId = mongoose.isValidObjectId(adminAuth.user.id)
      ? new mongoose.Types.ObjectId(adminAuth.user.id)
      : undefined

    if (targetStatus === 'UNDER_REVIEW') {
      invoice.reviewedAt = now
      if (adminUserId) invoice.reviewedByUserId = adminUserId
    }
    if (targetStatus === 'CHANGES_REQUESTED') invoice.changeRequestMessage = message
    if (targetStatus === 'REJECTED') invoice.rejectionReason = message
    if (targetStatus === 'APPROVED') {
      invoice.approvedAt = now
      if (adminUserId) invoice.reviewedByUserId = adminUserId
    }
    if (targetStatus === 'PAID') invoice.paidAt = now

    invoice.statusHistory.push({
      id: new mongoose.Types.ObjectId().toString(),
      previousStatus,
      newStatus: targetStatus,
      message: message || undefined,
      changedByUserId: String(adminAuth.user.id),
      changedByName: adminAuth.user.name,
      changedAt: now,
    })
    await invoice.save()

    await logSubcontractorActivity({
      actionType: ACTION_TO_AUDIT[action],
      description: `Rechnung ${invoice.invoiceNumber}: ${STATUS_LABELS[previousStatus as ReceivedInvoiceStatus]} → ${STATUS_LABELS[targetStatus]}`,
      userId: adminAuth.user.id,
      userName: adminAuth.user.name,
      userRole: adminAuth.user.role,
      entityId: invoice._id,
      subcontractorCompanyId: invoice.subcontractorCompanyId,
      before: { status: previousStatus },
      after: { status: targetStatus },
      meta: message ? { message } : undefined,
    })

    // Benachrichtigung an das Subunternehmen (best effort)
    try {
      const [company, creator] = await Promise.all([
        Subcompany.findById(invoice.subcontractorCompanyId).select('name contactEmail email').lean() as Promise<Record<string, any> | null>,
        User.findById(invoice.createdByUserId).select('email name').lean() as Promise<Record<string, any> | null>,
      ])
      const to = creator?.email || company?.contactEmail || company?.email
      if (to) {
        const subject = `Rechnung ${invoice.invoiceNumber}: ${STATUS_LABELS[targetStatus]}`
        const emailResult = await sendEmailResult({
          to,
          subject,
          html: `
            <div style="font-family: Arial, sans-serif; color: #111;">
              <h2 style="font-size:17px">Status Ihrer Rechnung ${invoice.invoiceNumber}</h2>
              <p>Der Status Ihrer Rechnung wurde auf <strong>${STATUS_LABELS[targetStatus]}</strong> geändert.</p>
              ${message ? `<p><strong>Nachricht:</strong> ${message}</p>` : ''}
              <p>Details finden Sie im Gleistrix Subunternehmen-Portal unter „Rechnungen“.</p>
            </div>
          `,
        })
        await NotificationLog.create({
          key: 'Subunternehmen-Rechnung Statusänderung',
          to,
          subject,
          success: emailResult.ok,
          errorMessage: emailResult.error,
          meta: {
            invoiceId: String(invoice._id),
            invoiceNumber: invoice.invoiceNumber,
            newStatus: targetStatus,
          },
        })
      }
    } catch (notifyError) {
      logger.warn('Benachrichtigung über Statuswechsel fehlgeschlagen', notifyError)
    }

    return NextResponse.json({ success: true, invoice: serializeInvoiceForAdmin(invoice.toObject()) })
  } catch (error) {
    logger.error('Statuswechsel der erhaltenen Rechnung fehlgeschlagen', error)
    return NextResponse.json({ error: 'Fehler beim Statuswechsel' }, { status: 500 })
  }
}
