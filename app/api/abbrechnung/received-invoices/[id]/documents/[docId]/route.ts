import { NextRequest, NextResponse } from 'next/server'
import mongoose from 'mongoose'
import dbConnect from '@/lib/dbConnect'
import ReceivedInvoice from '@/lib/models/ReceivedInvoice'
import SubcontractorDocument from '@/lib/models/SubcontractorDocument'
import { requireAdminUser } from '@/lib/auth/requireAdminUser'
import { isFeatureEnabled } from '@/lib/featureFlags'
import { getObjectBufferAsync } from '@/lib/storage/minioClient'
import { logSubcontractorActivity } from '@/lib/subunternehmen/audit'
import { logger } from '@/lib/logger'

/** Dokument einer erhaltenen Rechnung herunterladen (PDF, Anhänge). */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const adminAuth = await requireAdminUser(req)
    if (!adminAuth.ok) {
      return NextResponse.json({ error: adminAuth.error }, { status: adminAuth.status })
    }
    if (!(await isFeatureEnabled('receivedInvoicesEnabled'))) {
      return NextResponse.json({ error: 'Erhaltene Rechnungen sind deaktiviert' }, { status: 403 })
    }

    await dbConnect()
    const { id, docId } = await params
    if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(docId)) {
      return NextResponse.json({ error: 'Dokument nicht gefunden' }, { status: 404 })
    }

    const invoice = await ReceivedInvoice.findById(id).select('invoiceNumber subcontractorCompanyId status').lean() as Record<string, any> | null
    if (!invoice || invoice.status === 'DRAFT') {
      return NextResponse.json({ error: 'Rechnung nicht gefunden' }, { status: 404 })
    }

    // Dokument muss zur Rechnung gehören (kein Zugriff auf fremde Objekte)
    const docMeta = await SubcontractorDocument.findOne({ _id: docId, invoiceId: id }).lean() as Record<string, any> | null
    if (!docMeta) {
      return NextResponse.json({ error: 'Dokument nicht gefunden' }, { status: 404 })
    }

    const buffer = await getObjectBufferAsync(docMeta.bucket, docMeta.objectKey)

    await logSubcontractorActivity({
      actionType: 'subcontractor_document_downloaded',
      description: `Dokument heruntergeladen: ${docMeta.name} (Rechnung ${invoice.invoiceNumber})`,
      userId: adminAuth.user.id,
      userName: adminAuth.user.name,
      userRole: adminAuth.user.role,
      entityId: docMeta._id,
      subcontractorCompanyId: invoice.subcontractorCompanyId,
    })

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': docMeta.contentType || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${docMeta.name}"`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (error) {
    logger.error('Dokument konnte nicht geladen werden', error)
    return NextResponse.json({ error: 'Fehler beim Laden des Dokuments' }, { status: 500 })
  }
}
