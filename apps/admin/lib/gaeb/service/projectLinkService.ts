import dbConnect from '@/lib/dbConnect'
import GaebImportJob from '@/lib/models/GaebImportJob'
import GaebBillOfQuantities from '@/lib/models/GaebBillOfQuantities'
import GaebFile from '@/lib/models/GaebFile'
import Ausschreibung from '@/lib/models/Ausschreibung'
import { Project } from '@/lib/models/Project'
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
  await linkGaebAsProjectDocument(projectId, jobId)
  return { ok: true }
}

/**
 * Verknüpft die GAEB-Rohdatei als Projektdokument (Download/Vorschau über die
 * bestehende Content-Route, die die minio://-URL auflöst – kein Kopieren nötig).
 * Idempotent über den Marker `gaebImportJobId`.
 */
export async function linkGaebAsProjectDocument(projectId: string, jobId: string): Promise<void> {
  await dbConnect()

  const job = (await GaebImportJob.findById(jobId).lean()) as Record<string, unknown> | null
  if (!job?.fileId) return
  const file = (await GaebFile.findById(String(job.fileId)).lean()) as Record<string, unknown> | null
  if (!file?.bucket || !file?.storageKey) return

  const project = await Project.findById(projectId)
  if (!project) return
  if (!(project as { dokumente?: unknown }).dokumente || typeof (project as { dokumente?: unknown }).dokumente !== 'object') {
    (project as { dokumente?: unknown }).dokumente = {}
  }
  const dokumente = (project as unknown as { dokumente: { all?: Array<Record<string, unknown>> } }).dokumente
  if (!Array.isArray(dokumente.all)) dokumente.all = []

  // Bereits verlinkt? → nichts tun
  if (dokumente.all.some((d) => d && d.gaebImportJobId === jobId)) return

  dokumente.all.push({
    id: Date.now().toString() + Math.random().toString(36).slice(2),
    name: String(file.originalName ?? 'GAEB-LV'),
    description: 'GAEB-LV (importiert)',
    url: `minio://${String(file.bucket)}/${String(file.storageKey)}`,
    gaebImportJobId: jobId,
  })

  ;(project as unknown as { markModified: (p: string) => void }).markModified('dokumente')
  await (project as unknown as { save: () => Promise<unknown> }).save()
}

/** Entfernt den GAEB-Projektdokument-Eintrag (z.B. beim Löschen des Imports). */
export async function unlinkGaebProjectDocument(projectId: string, jobId: string): Promise<void> {
  await dbConnect()
  const project = await Project.findById(projectId)
  if (!project) return
  const dokumente = (project as unknown as { dokumente?: { all?: Array<Record<string, unknown>> } }).dokumente
  if (!dokumente || !Array.isArray(dokumente.all)) return
  const before = dokumente.all.length
  dokumente.all = dokumente.all.filter((d) => !(d && d.gaebImportJobId === jobId))
  if (dokumente.all.length !== before) {
    (project as unknown as { markModified: (p: string) => void }).markModified('dokumente')
    await (project as unknown as { save: () => Promise<unknown> }).save()
  }
}
