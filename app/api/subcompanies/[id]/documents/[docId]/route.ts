import { NextRequest, NextResponse } from 'next/server'
import { hasValidCsrfIntent } from '@/lib/security/requireCsrfIntent'
import mongoose from 'mongoose'
import dbConnect from '@/lib/dbConnect'
import SubcontractorDocument from '@/lib/models/SubcontractorDocument'
import { requireAdminUser } from '@/lib/auth/requireAdminUser'
import { getObjectBufferAsync, removeObject } from '@/lib/storage/minioClient'
import { logSubcontractorActivity } from '@/lib/subunternehmen/audit'
import { logger } from '@/lib/logger'

async function findCompanyDocument(companyId: string, docId: string) {
  if (!mongoose.isValidObjectId(companyId) || !mongoose.isValidObjectId(docId)) return null
  return SubcontractorDocument.findOne({ _id: docId, subcontractorCompanyId: companyId })
}

/** Dokument eines Subunternehmens herunterladen (intern). */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const adminAuth = await requireAdminUser(req)
    if (!adminAuth.ok) return NextResponse.json({ error: adminAuth.error }, { status: adminAuth.status })

    await dbConnect()
    const { id, docId } = await params
    const doc = await findCompanyDocument(id, docId)
    if (!doc) return NextResponse.json({ error: 'Dokument nicht gefunden' }, { status: 404 })

    const buffer = await getObjectBufferAsync(doc.bucket, doc.objectKey)

    await logSubcontractorActivity({
      actionType: 'subcontractor_document_downloaded',
      description: `Dokument heruntergeladen: ${doc.name}`,
      userId: adminAuth.user.id,
      userName: adminAuth.user.name,
      userRole: adminAuth.user.role,
      entityId: doc._id,
      subcontractorCompanyId: doc.subcontractorCompanyId,
    })

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': doc.contentType || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${doc.name}"`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (error) {
    logger.error('Subunternehmen-Dokument konnte nicht geladen werden', error)
    return NextResponse.json({ error: 'Fehler beim Laden des Dokuments' }, { status: 500 })
  }
}

/**
 * Dokument löschen (intern). Rechnungs-PDFs sind unveränderbar und bleiben
 * vom Löschen ausgenommen.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const adminAuth = await requireAdminUser(req)
    if (!adminAuth.ok) return NextResponse.json({ error: adminAuth.error }, { status: adminAuth.status })
    if (!hasValidCsrfIntent(req, 'sub:document-delete')) {
      return NextResponse.json({ error: 'Ungültige Anforderung' }, { status: 400 })
    }

    await dbConnect()
    const { id, docId } = await params
    const doc = await findCompanyDocument(id, docId)
    if (!doc) return NextResponse.json({ error: 'Dokument nicht gefunden' }, { status: 404 })
    if (doc.type === 'INVOICE_PDF') {
      return NextResponse.json(
        { error: 'Rechnungs-PDFs sind unveränderbar und können nicht gelöscht werden' },
        { status: 409 }
      )
    }

    try {
      await removeObject(doc.bucket, doc.objectKey)
    } catch (storageError) {
      logger.warn('MinIO-Objekt konnte nicht entfernt werden', storageError)
    }
    await doc.deleteOne()

    return NextResponse.json({ success: true, message: 'Dokument gelöscht' })
  } catch (error) {
    logger.error('Subunternehmen-Dokument konnte nicht gelöscht werden', error)
    return NextResponse.json({ error: 'Fehler beim Löschen des Dokuments' }, { status: 500 })
  }
}
