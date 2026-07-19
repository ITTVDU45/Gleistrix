import { NextRequest, NextResponse } from 'next/server'
import mongoose from 'mongoose'
import dbConnect from '@/lib/dbConnect'
import ReceivedInvoice from '@/lib/models/ReceivedInvoice'
import SubcontractorDocument from '@/lib/models/SubcontractorDocument'
import { requireSubcontractor } from '@/lib/subunternehmen/access'
import { getObjectBufferAsync } from '@/lib/storage/minioClient'
import { logSubcontractorActivity } from '@/lib/subunternehmen/audit'
import { logger } from '@/lib/logger'

/** Rechnungs-PDF der eigenen Rechnung herunterladen. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireSubcontractor(req, 'subcontractor.invoices.read')
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

    await dbConnect()
    const { id } = await params
    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json({ error: 'Rechnung nicht gefunden' }, { status: 404 })
    }

    const invoice = await ReceivedInvoice.findOne({
      _id: id,
      subcontractorCompanyId: auth.ctx.companyId,
    })
      .select('generatedPdfDocumentId invoiceNumber')
      .lean() as { generatedPdfDocumentId?: mongoose.Types.ObjectId; invoiceNumber?: string } | null
    if (!invoice) return NextResponse.json({ error: 'Rechnung nicht gefunden' }, { status: 404 })
    if (!invoice.generatedPdfDocumentId) {
      return NextResponse.json({ error: 'Für diese Rechnung existiert noch keine PDF' }, { status: 404 })
    }

    const docMeta = await SubcontractorDocument.findOne({
      _id: invoice.generatedPdfDocumentId,
      subcontractorCompanyId: auth.ctx.companyId,
    }).lean() as { bucket: string; objectKey: string; name: string } | null
    if (!docMeta) return NextResponse.json({ error: 'Dokument nicht gefunden' }, { status: 404 })

    const buffer = await getObjectBufferAsync(docMeta.bucket, docMeta.objectKey)

    await logSubcontractorActivity({
      actionType: 'subcontractor_document_downloaded',
      description: `Rechnungs-PDF heruntergeladen: ${docMeta.name} (Rechnung ${invoice.invoiceNumber || ''})`,
      userId: auth.ctx.userId,
      userName: auth.ctx.userName,
      userRole: 'subunternehmen',
      entityId: invoice.generatedPdfDocumentId,
      subcontractorCompanyId: auth.ctx.companyId,
    })

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${docMeta.name}"`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (error) {
    logger.error('Portal: Rechnungs-PDF konnte nicht geladen werden', error)
    return NextResponse.json({ error: 'Fehler beim Laden der PDF' }, { status: 500 })
  }
}
