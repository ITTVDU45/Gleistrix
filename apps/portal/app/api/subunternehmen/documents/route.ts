import { NextRequest, NextResponse } from 'next/server'
import { hasValidCsrfIntent } from '@/lib/security/requireCsrfIntent'
import mongoose from 'mongoose'
import dbConnect from '@/lib/dbConnect'
import SubcontractorDocument from '@/lib/models/SubcontractorDocument'
import ReceivedInvoice from '@/lib/models/ReceivedInvoice'
import { requireSubcontractor } from '@/lib/subunternehmen/access'
import { findProjectForCompany } from '@/lib/subunternehmen/queries'
import minioClient, {
  bucketExistsAsync,
  makeBucketAsync,
  getSubcontractorDocumentObjectKey,
} from '@/lib/storage/minioClient'
import { logSubcontractorActivity } from '@/lib/subunternehmen/audit'
import { logger } from '@/lib/logger'

const MAX_BYTES = Number(process.env.MAX_UPLOAD_SIZE_BYTES || 50 * 1024 * 1024)
const ALLOWED_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]
const UPLOADABLE_DOC_TYPES = [
  'TIMESHEET', 'SERVICE_PROOF', 'CERTIFICATE', 'QUALIFICATION', 'INVOICE_ATTACHMENT', 'OTHER',
]

const serialize = (d: Record<string, any>) => ({
  id: String(d._id),
  subcontractorCompanyId: String(d.subcontractorCompanyId),
  projectId: d.projectId ? String(d.projectId) : undefined,
  invoiceId: d.invoiceId ? String(d.invoiceId) : undefined,
  type: d.type,
  name: d.name,
  contentType: d.contentType,
  size: d.size,
  uploadedByName: d.uploadedByName,
  source: d.source,
  createdAt: d.createdAt,
})

/** Eigene/freigegebene Dokumente auflisten (ohne interne Prüfunterlagen). */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireSubcontractor(req, 'subcontractor.documents.read')
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

    await dbConnect()
    const { searchParams } = new URL(req.url)
    const projectId = searchParams.get('projectId')

    const query: Record<string, unknown> = {
      subcontractorCompanyId: auth.ctx.companyId,
      type: { $ne: 'INTERNAL_REVIEW' },
    }
    if (projectId && mongoose.isValidObjectId(projectId)) query.projectId = projectId

    const documents = await SubcontractorDocument.find(query).sort({ createdAt: -1 }).limit(500).lean()
    return NextResponse.json({
      success: true,
      documents: (documents as Array<Record<string, any>>).map(serialize),
    })
  } catch (error) {
    logger.error('Portal: Dokumente konnten nicht geladen werden', error)
    return NextResponse.json({ error: 'Fehler beim Laden der Dokumente' }, { status: 500 })
  }
}

/** Dokument hochladen (Leistungs-/Stundennachweise, Zertifikate, Anhänge). */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireSubcontractor(req, 'subcontractor.documents.upload')
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
    if (!hasValidCsrfIntent(req, 'sub:document-upload')) {
      return NextResponse.json({ error: 'Ungültige Anforderung' }, { status: 400 })
    }

    await dbConnect()
    const { ctx } = auth

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const docType = String(formData.get('type') || 'OTHER')
    const projectId = formData.get('projectId') ? String(formData.get('projectId')) : undefined
    const invoiceId = formData.get('invoiceId') ? String(formData.get('invoiceId')) : undefined
    const displayName = formData.get('name') ? String(formData.get('name')) : undefined

    if (!file) {
      return NextResponse.json({ error: 'Keine Datei übermittelt' }, { status: 400 })
    }
    if (!UPLOADABLE_DOC_TYPES.includes(docType)) {
      return NextResponse.json({ error: 'Unzulässiger Dokumenttyp' }, { status: 400 })
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: `Datei zu groß (max. ${Math.round(MAX_BYTES / 1024 / 1024)} MB)` },
        { status: 413 }
      )
    }
    if (!(ALLOWED_TYPES.includes(file.type) || file.type.startsWith('image/'))) {
      return NextResponse.json({ error: `Unzulässiger Dateityp: ${file.type}` }, { status: 415 })
    }

    // Projektzuordnung nur zu eigenen Projekten (IDOR-Schutz)
    if (projectId) {
      const project = await findProjectForCompany(projectId, ctx.companyId)
      if (!project) {
        return NextResponse.json({ error: 'Projekt nicht gefunden' }, { status: 404 })
      }
    }

    // Rechnungszuordnung nur zu eigenen Rechnungen (IDOR-Schutz)
    if (invoiceId) {
      if (!mongoose.isValidObjectId(invoiceId)) {
        return NextResponse.json({ error: 'Rechnung nicht gefunden' }, { status: 404 })
      }
      const invoice = await ReceivedInvoice.findOne({
        _id: invoiceId,
        subcontractorCompanyId: ctx.companyId,
      }).select('_id').lean()
      if (!invoice) {
        return NextResponse.json({ error: 'Rechnung nicht gefunden' }, { status: 404 })
      }
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const bucket = process.env.MINIO_BUCKET || 'project-documents'
    if (!process.env.MINIO_BUCKET) {
      const exists = await bucketExistsAsync(bucket)
      if (!exists) await makeBucketAsync(bucket)
    }
    const objectKey = getSubcontractorDocumentObjectKey(String(ctx.companyId), file.name)
    await minioClient.putObject(bucket, objectKey, buffer, buffer.length, {
      'Content-Type': file.type || 'application/octet-stream',
    })

    const doc = await SubcontractorDocument.create({
      subcontractorCompanyId: ctx.companyId,
      projectId: projectId && mongoose.isValidObjectId(projectId) ? projectId : undefined,
      invoiceId: invoiceId && mongoose.isValidObjectId(invoiceId) ? invoiceId : undefined,
      type: docType,
      name: displayName?.trim() || file.name,
      bucket,
      objectKey,
      contentType: file.type,
      size: buffer.length,
      uploadedByUserId: ctx.userId,
      uploadedByName: ctx.userName,
      source: 'subcontractor',
    })

    await logSubcontractorActivity({
      actionType: 'subcontractor_document_uploaded',
      description: `Dokument hochgeladen: ${doc.name} (${ctx.companyName})`,
      userId: ctx.userId,
      userName: ctx.userName,
      userRole: 'subunternehmen',
      entityId: doc._id,
      subcontractorCompanyId: ctx.companyId,
      meta: { type: docType, size: buffer.length },
    })

    return NextResponse.json({ success: true, document: serialize(doc.toObject()) }, { status: 201 })
  } catch (error) {
    logger.error('Portal: Dokument konnte nicht hochgeladen werden', error)
    return NextResponse.json({ error: 'Fehler beim Hochladen des Dokuments' }, { status: 500 })
  }
}
