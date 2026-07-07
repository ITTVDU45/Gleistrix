import { NextRequest, NextResponse } from 'next/server'
import mongoose from 'mongoose'
import dbConnect from '@/lib/dbConnect'
import { requireAuth } from '@/lib/security/requireAuth'
import { removeObject } from '@/lib/storage/minioClient'
import GaebImportJob from '@/lib/models/GaebImportJob'
import GaebFile from '@/lib/models/GaebFile'
import GaebBillOfQuantities from '@/lib/models/GaebBillOfQuantities'
import { unlinkGaebProjectDocument } from '@/lib/gaeb/service/projectLinkService'

function isValidId(id: string): boolean {
  return mongoose.Types.ObjectId.isValid(id)
}

/** GET: Import-Job inkl. Datei-Metadaten. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req, ['admin', 'superadmin'])
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
  }
  const { id } = await params
  if (!isValidId(id)) {
    return NextResponse.json({ success: false, error: 'Ungültige ID' }, { status: 400 })
  }

  await dbConnect()
  const job = (await GaebImportJob.findById(id).lean()) as Record<string, unknown> | null
  if (!job) {
    return NextResponse.json({ success: false, error: 'Import nicht gefunden' }, { status: 404 })
  }
  const file = (await GaebFile.findById(String(job.fileId)).lean()) as Record<string, unknown> | null
  const boq = job.boqId
    ? await GaebBillOfQuantities.findById(String(job.boqId)).lean()
    : null

  return NextResponse.json({ success: true, data: { job, file, boq } })
}

/** DELETE: Job + Datei-Metadaten + MinIO-Objekt entfernen. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req, ['admin', 'superadmin'])
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
  }
  const { id } = await params
  if (!isValidId(id)) {
    return NextResponse.json({ success: false, error: 'Ungültige ID' }, { status: 400 })
  }

  await dbConnect()
  const job = (await GaebImportJob.findById(id).lean()) as Record<string, unknown> | null
  if (!job) {
    return NextResponse.json({ success: false, error: 'Import nicht gefunden' }, { status: 404 })
  }

  const file = (await GaebFile.findById(String(job.fileId)).lean()) as Record<string, unknown> | null
  if (file?.bucket && file?.storageKey) {
    try {
      await removeObject(String(file.bucket), String(file.storageKey))
    } catch (e) {
      console.warn('GAEB MinIO removeObject failed:', e)
    }
  }
  if (file) await GaebFile.findByIdAndDelete(String(file._id))

  // Verlinktes Projektdokument entfernen (best-effort)
  const projectId = (job.assignment as { projectId?: string } | null)?.projectId
  if (projectId) {
    try {
      await unlinkGaebProjectDocument(projectId, id)
    } catch (e) {
      console.warn('GAEB unlink project document failed:', e)
    }
  }

  await GaebImportJob.findByIdAndDelete(id)

  return NextResponse.json({ success: true })
}
