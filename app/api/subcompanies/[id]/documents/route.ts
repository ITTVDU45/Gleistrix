import { NextRequest, NextResponse } from 'next/server'
import { hasValidCsrfIntent } from '@/lib/security/requireCsrfIntent'
import mongoose from 'mongoose'
import dbConnect from '@/lib/dbConnect'
import SubcontractorDocument from '@/lib/models/SubcontractorDocument'
import { Subcompany } from '@/lib/models/Subcompany'
import { requireAdminUser } from '@/lib/auth/requireAdminUser'
import minioClient, {
  bucketExistsAsync,
  makeBucketAsync,
  getSubcontractorDocumentObjectKey,
} from '@/lib/storage/minioClient'
import { logSubcontractorActivity } from '@/lib/subunternehmen/audit'
import { logger } from '@/lib/logger'

const MAX_BYTES = Number(process.env.MAX_UPLOAD_SIZE_BYTES || 50 * 1024 * 1024)

/** Dokumente eines Subunternehmens auflisten (intern, inkl. Uploads des Portals). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const adminAuth = await requireAdminUser(req)
    if (!adminAuth.ok) return NextResponse.json({ error: adminAuth.error }, { status: adminAuth.status })

    await dbConnect()
    const { id } = await params
    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json({ error: 'Subunternehmen nicht gefunden' }, { status: 404 })
    }

    const documents = await SubcontractorDocument.find({ subcontractorCompanyId: id })
      .sort({ createdAt: -1 })
      .limit(500)
      .lean()

    return NextResponse.json({
      success: true,
      documents: (documents as Array<Record<string, any>>).map((d) => ({
        id: String(d._id),
        projectId: d.projectId ? String(d.projectId) : undefined,
        invoiceId: d.invoiceId ? String(d.invoiceId) : undefined,
        type: d.type,
        name: d.name,
        contentType: d.contentType,
        size: d.size,
        uploadedByName: d.uploadedByName,
        source: d.source,
        createdAt: d.createdAt,
      })),
    })
  } catch (error) {
    logger.error('Subunternehmen-Dokumente konnten nicht geladen werden', error)
    return NextResponse.json({ error: 'Fehler beim Laden der Dokumente' }, { status: 500 })
  }
}

/**
 * Dokument für ein Subunternehmen bereitstellen (intern → Portal).
 * type=INTERNAL_REVIEW bleibt ausschließlich intern sichtbar.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const adminAuth = await requireAdminUser(req)
    if (!adminAuth.ok) return NextResponse.json({ error: adminAuth.error }, { status: adminAuth.status })
    if (!hasValidCsrfIntent(req, 'sub:document-upload')) {
      return NextResponse.json({ error: 'Ungültige Anforderung' }, { status: 400 })
    }

    await dbConnect()
    const { id } = await params
    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json({ error: 'Subunternehmen nicht gefunden' }, { status: 404 })
    }
    const company = await Subcompany.findById(id).select('name').lean() as { name?: string } | null
    if (!company) {
      return NextResponse.json({ error: 'Subunternehmen nicht gefunden' }, { status: 404 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const docType = String(formData.get('type') || 'PROJECT_DOCUMENT')
    const projectId = formData.get('projectId') ? String(formData.get('projectId')) : undefined

    if (!file) return NextResponse.json({ error: 'Keine Datei übermittelt' }, { status: 400 })
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'Datei zu groß' }, { status: 413 })
    }
    const allowedTypes = ['PROJECT_DOCUMENT', 'CERTIFICATE', 'OTHER', 'INTERNAL_REVIEW']
    if (!allowedTypes.includes(docType)) {
      return NextResponse.json({ error: 'Unzulässiger Dokumenttyp' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const bucket = process.env.MINIO_BUCKET || 'project-documents'
    if (!process.env.MINIO_BUCKET) {
      const exists = await bucketExistsAsync(bucket)
      if (!exists) await makeBucketAsync(bucket)
    }
    const objectKey = getSubcontractorDocumentObjectKey(id, file.name)
    await minioClient.putObject(bucket, objectKey, buffer, buffer.length, {
      'Content-Type': file.type || 'application/octet-stream',
    })

    const doc = await SubcontractorDocument.create({
      subcontractorCompanyId: id,
      projectId: projectId && mongoose.isValidObjectId(projectId) ? projectId : undefined,
      type: docType,
      name: file.name,
      bucket,
      objectKey,
      contentType: file.type,
      size: buffer.length,
      uploadedByUserId: mongoose.isValidObjectId(adminAuth.user.id) ? adminAuth.user.id : undefined,
      uploadedByName: adminAuth.user.name,
      source: 'internal',
    })

    await logSubcontractorActivity({
      actionType: 'subcontractor_document_uploaded',
      description: `Dokument für Subunternehmen bereitgestellt: ${file.name} (${company.name})`,
      userId: adminAuth.user.id,
      userName: adminAuth.user.name,
      userRole: adminAuth.user.role,
      entityId: doc._id,
      subcontractorCompanyId: id,
      meta: { type: docType },
    })

    return NextResponse.json({ success: true, documentId: String(doc._id) }, { status: 201 })
  } catch (error) {
    logger.error('Dokument konnte nicht bereitgestellt werden', error)
    return NextResponse.json({ error: 'Fehler beim Bereitstellen des Dokuments' }, { status: 500 })
  }
}
