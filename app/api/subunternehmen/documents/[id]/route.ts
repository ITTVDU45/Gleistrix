import { NextRequest, NextResponse } from 'next/server'
import { hasValidCsrfIntent } from '@/lib/security/requireCsrfIntent'
import mongoose from 'mongoose'
import dbConnect from '@/lib/dbConnect'
import SubcontractorDocument from '@/lib/models/SubcontractorDocument'
import { requireSubcontractor } from '@/lib/subunternehmen/access'
import { getObjectBufferAsync, removeObject } from '@/lib/storage/minioClient'
import { logSubcontractorActivity } from '@/lib/subunternehmen/audit'
import { logger } from '@/lib/logger'

/** Eigenes/freigegebenes Dokument herunterladen. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireSubcontractor(req, 'subcontractor.documents.read')
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

    await dbConnect()
    const { id } = await params
    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json({ error: 'Dokument nicht gefunden' }, { status: 404 })
    }

    // Scope: ausschließlich Dokumente des eigenen Subunternehmens,
    // interne Prüfunterlagen sind grundsätzlich ausgeschlossen.
    const doc = await SubcontractorDocument.findOne({
      _id: id,
      subcontractorCompanyId: auth.ctx.companyId,
      type: { $ne: 'INTERNAL_REVIEW' },
    }).lean() as Record<string, any> | null
    if (!doc) return NextResponse.json({ error: 'Dokument nicht gefunden' }, { status: 404 })

    const buffer = await getObjectBufferAsync(doc.bucket, doc.objectKey)

    await logSubcontractorActivity({
      actionType: 'subcontractor_document_downloaded',
      description: `Dokument heruntergeladen: ${doc.name} (${auth.ctx.companyName})`,
      userId: auth.ctx.userId,
      userName: auth.ctx.userName,
      userRole: 'subunternehmen',
      entityId: doc._id,
      subcontractorCompanyId: auth.ctx.companyId,
    })

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': doc.contentType || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${doc.name}"`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (error) {
    logger.error('Portal: Dokument konnte nicht geladen werden', error)
    return NextResponse.json({ error: 'Fehler beim Laden des Dokuments' }, { status: 500 })
  }
}

/** Selbst hochgeladenes Dokument löschen (keine Rechnungs-PDFs, keine internen Dateien). */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireSubcontractor(req, 'subcontractor.documents.upload')
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
    if (!hasValidCsrfIntent(req, 'sub:document-delete')) {
      return NextResponse.json({ error: 'Ungültige Anforderung' }, { status: 400 })
    }

    await dbConnect()
    const { id } = await params
    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json({ error: 'Dokument nicht gefunden' }, { status: 404 })
    }

    const doc = await SubcontractorDocument.findOne({
      _id: id,
      subcontractorCompanyId: auth.ctx.companyId,
      source: 'subcontractor',
      type: { $nin: ['INVOICE_PDF', 'INTERNAL_REVIEW'] },
    })
    if (!doc) {
      return NextResponse.json(
        { error: 'Dokument nicht gefunden oder nicht löschbar' },
        { status: 404 }
      )
    }

    try {
      await removeObject(doc.bucket, doc.objectKey)
    } catch (storageError) {
      logger.warn('Portal: MinIO-Objekt konnte nicht entfernt werden', storageError)
    }
    await doc.deleteOne()

    return NextResponse.json({ success: true, message: 'Dokument gelöscht' })
  } catch (error) {
    logger.error('Portal: Dokument konnte nicht gelöscht werden', error)
    return NextResponse.json({ error: 'Fehler beim Löschen des Dokuments' }, { status: 500 })
  }
}
