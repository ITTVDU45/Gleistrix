import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import stream from 'stream'
import { promisify } from 'util'
import dbConnect from '@/lib/dbConnect'
import { requireAuth } from '@/lib/security/requireAuth'
import minioClient, { getGaebObjectKey } from '@/lib/storage/minioClient'
import GaebFile from '@/lib/models/GaebFile'
import GaebImportJob from '@/lib/models/GaebImportJob'
import { loadGaebSettings } from '@/lib/gaeb/settingsService'
import { validateGaebUpload } from '@/lib/gaeb/upload'

/**
 * POST /api/gaeb/upload
 * Nimmt eine GAEB-Datei entgegen, prüft Freischaltung/Größe/Endung, speichert
 * sie sicher in MinIO und legt GaebFile + GaebImportJob (Status: hochgeladen) an.
 * Es wird noch nicht geparst (Parsing = spätere Phase).
 */
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, ['admin', 'superadmin'])
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
  }

  await dbConnect()

  const settings = await loadGaebSettings()
  if (!settings.enabled) {
    return NextResponse.json(
      { success: false, error: 'GAEB-Integration ist deaktiviert' },
      { status: 409 }
    )
  }

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ success: false, error: 'Ungültiger Upload' }, { status: 400 })
  }

  const file = formData.get('file')
  if (!file || typeof file === 'string') {
    return NextResponse.json({ success: false, error: 'Keine Datei übermittelt' }, { status: 400 })
  }

  const blob = file as File
  const projectIdRaw = formData.get('projectId')
  const projectId = typeof projectIdRaw === 'string' && projectIdRaw.trim() ? projectIdRaw.trim() : undefined
  const validation = validateGaebUpload({
    name: blob.name,
    sizeBytes: blob.size,
    maxFileSizeBytes: settings.maxFileSizeBytes,
  })
  if (!validation.ok) {
    return NextResponse.json({ success: false, error: validation.error }, { status: 400 })
  }

  const buffer = Buffer.from(await blob.arrayBuffer())
  const sha256 = crypto.createHash('sha256').update(buffer).digest('hex')

  // Import-Job zuerst anlegen, um eine stabile ID für den Storage-Key zu erhalten
  const job = await GaebImportJob.create({
    fileId: 'pending',
    status: 'hochgeladen',
    assignment: projectId ? { projectId } : null,
    createdByUserId: (auth.token as { sub?: string })?.sub ?? null,
  })
  const jobId = String(job._id)

  const bucket = process.env.MINIO_GAEB_BUCKET || process.env.MINIO_BUCKET || 'gaeb-files'
  // Bucket sicherstellen (nur wenn nicht explizit fest vorgegeben)
  if (!process.env.MINIO_BUCKET && !process.env.MINIO_GAEB_BUCKET) {
    try {
      const exists = await minioClient.bucketExists(bucket)
      if (!exists) await minioClient.makeBucket(bucket)
    } catch (e) {
      logger.warn('MinIO GAEB bucket check failed:', e)
    }
  }

  const key = getGaebObjectKey(jobId, blob.name)
  try {
    const readable = new stream.Readable()
    readable._read = () => {}
    readable.push(buffer)
    readable.push(null)
    await promisify(minioClient.putObject.bind(minioClient))(bucket, key, readable, buffer.byteLength)
  } catch (e) {
    logger.error('GAEB MinIO upload failed:', e)
    await GaebImportJob.findByIdAndUpdate(jobId, { status: 'fehler', error: 'Speicherung fehlgeschlagen' })
    return NextResponse.json({ success: false, error: 'Datei konnte nicht gespeichert werden' }, { status: 500 })
  }

  const gaebFile = await GaebFile.create({
    originalName: blob.name,
    storageKey: key,
    bucket,
    sizeBytes: buffer.byteLength,
    mimeType: blob.type || '',
    sha256,
    uploadedByUserId: (auth.token as { sub?: string })?.sub ?? null,
  })

  await GaebImportJob.findByIdAndUpdate(jobId, { fileId: String(gaebFile._id) })

  return NextResponse.json({
    success: true,
    data: {
      importJobId: jobId,
      fileId: String(gaebFile._id),
      originalName: blob.name,
      sizeBytes: buffer.byteLength,
      sha256,
      status: 'hochgeladen',
    },
  })
}
