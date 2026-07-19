import { NextRequest, NextResponse } from 'next/server'
import { hasValidCsrfIntent } from '@/lib/security/requireCsrfIntent'
import mongoose from 'mongoose'
import { z } from 'zod'
import dbConnect from '@/lib/dbConnect'
import ReceivedInvoice from '@/lib/models/ReceivedInvoice'
import { requireAdminUser } from '@/lib/auth/requireAdminUser'
import { isFeatureEnabled } from '@/lib/featureFlags'
import { serializeInvoiceForAdmin } from '@/lib/subunternehmen/serialize'
import { logger } from '@/lib/logger'

const noteSchema = z.object({ text: z.string().min(1).max(2000) })

/**
 * Interne Prüfnotiz ergänzen. Notizen erscheinen ausschließlich im
 * Admin-Bereich – niemals im Subunternehmen-Portal.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const adminAuth = await requireAdminUser(req)
    if (!adminAuth.ok) {
      return NextResponse.json({ error: adminAuth.error }, { status: adminAuth.status })
    }
    if (!hasValidCsrfIntent(req, 'received-invoices:note')) {
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

    const parsed = noteSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'Notiztext fehlt' }, { status: 400 })
    }

    const invoice = await ReceivedInvoice.findById(id)
    if (!invoice || invoice.status === 'DRAFT') {
      return NextResponse.json({ error: 'Rechnung nicht gefunden' }, { status: 404 })
    }

    invoice.internalNotes.push({
      id: new mongoose.Types.ObjectId().toString(),
      text: parsed.data.text.trim(),
      createdByUserId: mongoose.isValidObjectId(adminAuth.user.id)
        ? new mongoose.Types.ObjectId(adminAuth.user.id)
        : undefined,
      createdByName: adminAuth.user.name,
      createdAt: new Date(),
    })
    await invoice.save()

    return NextResponse.json({ success: true, invoice: serializeInvoiceForAdmin(invoice.toObject()) })
  } catch (error) {
    logger.error('Interne Notiz konnte nicht gespeichert werden', error)
    return NextResponse.json({ error: 'Fehler beim Speichern der Notiz' }, { status: 500 })
  }
}
