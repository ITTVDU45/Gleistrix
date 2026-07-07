import { NextRequest, NextResponse } from 'next/server'
import dbConnect from '@/lib/dbConnect'
import { requireAuth } from '@/lib/security/requireAuth'
import GaebImportJob from '@/lib/models/GaebImportJob'
import GaebFile from '@/lib/models/GaebFile'

/**
 * GET /api/gaeb/imports
 * Import-Historie: Jobs (neueste zuerst) angereichert mit Datei-Metadaten.
 */
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, ['admin', 'superadmin'])
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
  }

  await dbConnect()

  const jobs = (await GaebImportJob.find().sort({ createdAt: -1 }).limit(100).lean()) as Array<
    Record<string, unknown>
  >

  const fileIds = jobs.map((j) => String(j.fileId)).filter((id) => id && id !== 'pending')
  const files = (await GaebFile.find({ _id: { $in: fileIds } }).lean()) as Array<Record<string, unknown>>
  const fileById = new Map(files.map((f) => [String(f._id), f]))

  const data = jobs.map((j) => {
    const file = fileById.get(String(j.fileId))
    return {
      importJobId: String(j._id),
      fileId: String(j.fileId),
      originalName: (file?.originalName as string) ?? '—',
      sizeBytes: (file?.sizeBytes as number) ?? 0,
      status: j.status,
      version: j.version ?? null,
      phase: j.phase ?? null,
      error: j.error ?? null,
      createdAt: j.createdAt,
    }
  })

  return NextResponse.json({ success: true, data })
}
