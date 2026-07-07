import dbConnect from '@/lib/dbConnect'
import GaebImportJob from '@/lib/models/GaebImportJob'
import GaebBillOfQuantities from '@/lib/models/GaebBillOfQuantities'
import Ausschreibung from '@/lib/models/Ausschreibung'
import type { GaebBillOfQuantities as GaebBoqType } from '@/types/gaeb'

interface UpsertAusschreibungParams {
  jobId: string
  projectId: string
  boq: Pick<GaebBoqType, 'projectName' | 'version' | 'phase' | 'positionCount' | 'netSum' | 'currency'>
  boqId: string
  fileId?: string | null
  userId?: string | null
  fallbackName?: string
}

/** Legt/aktualisiert die projektbezogene Ausschreibung zu einem GAEB-Import. */
export async function upsertAusschreibung(params: UpsertAusschreibungParams): Promise<void> {
  await Ausschreibung.findOneAndUpdate(
    { importJobId: params.jobId },
    {
      projectId: params.projectId,
      kind: 'ausschreibung',
      source: 'gaeb',
      name: params.boq.projectName || params.fallbackName || 'GAEB-LV',
      version: params.boq.version,
      phase: params.boq.phase,
      importJobId: params.jobId,
      boqId: params.boqId,
      fileId: params.fileId ?? null,
      positionCount: params.boq.positionCount,
      netSum: params.boq.netSum ?? null,
      currency: params.boq.currency,
      createdByUserId: params.userId ?? null,
    },
    { upsert: true, new: true }
  )
}

/**
 * Ordnet einen bereits geparsten (globalen) GAEB-Import nachträglich einem
 * Projekt zu – z.B. wenn der Import während der Projektanlage erfolgte.
 */
export async function assignImportToProject(
  jobId: string,
  projectId: string
): Promise<{ ok: boolean; error?: string }> {
  await dbConnect()

  const job = (await GaebImportJob.findById(jobId).lean()) as Record<string, unknown> | null
  if (!job) return { ok: false, error: 'Import-Job nicht gefunden' }
  if (!job.boqId) return { ok: false, error: 'Import ist noch nicht geparst' }

  const boqDoc = (await GaebBillOfQuantities.findById(String(job.boqId)).lean()) as Record<string, unknown> | null
  if (!boqDoc) return { ok: false, error: 'LV-Struktur nicht gefunden' }

  await upsertAusschreibung({
    jobId,
    projectId,
    boq: boqDoc as unknown as GaebBoqType,
    boqId: String(boqDoc._id),
    fileId: (job.fileId as string) ?? null,
    userId: (job.createdByUserId as string) ?? null,
  })

  await GaebImportJob.findByIdAndUpdate(jobId, { status: 'zugeordnet', assignment: { projectId } })
  return { ok: true }
}
