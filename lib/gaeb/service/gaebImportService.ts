import dbConnect from '@/lib/dbConnect'
import { getObjectBufferAsync } from '@/lib/storage/minioClient'
import GaebFile from '@/lib/models/GaebFile'
import GaebImportJob from '@/lib/models/GaebImportJob'
import GaebBillOfQuantities from '@/lib/models/GaebBillOfQuantities'
import { validateGaeb } from '@/lib/gaeb/validator'
import { parseGaeb } from '@/lib/gaeb/parser/parseGaeb'
import { loadGaebSettings } from '@/lib/gaeb/settingsService'
import type { GaebValidationResult } from '@/types/gaeb'

/** GAEB-Dateien sind oft ISO-8859-1-kodiert – Encoding aus dem Prolog erkennen. */
function decodeXmlBuffer(buffer: Buffer): string {
  const head = buffer.slice(0, 200).toString('latin1').toLowerCase()
  const match = head.match(/encoding=["']([^"']+)["']/)
  const enc = (match?.[1] || 'utf-8').toLowerCase()
  if (enc.includes('iso-8859') || enc.includes('latin')) return buffer.toString('latin1')
  if (enc.includes('utf-16')) return buffer.toString('utf16le')
  return buffer.toString('utf8')
}

export interface GaebImportRunResult {
  ok: boolean
  status: string
  validation: GaebValidationResult
  boqId?: string
  positionCount?: number
  error?: string
}

/**
 * Führt Validierung + Parsing für einen Import-Job aus:
 * MinIO laden → validieren (2-stufig) → bei gültiger Struktur parsen und BoQ
 * persistieren → Job-Status aktualisieren.
 */
export async function runGaebImport(jobId: string): Promise<GaebImportRunResult> {
  await dbConnect()

  const job = (await GaebImportJob.findById(jobId).lean()) as Record<string, unknown> | null
  if (!job) return errorResult('Import-Job nicht gefunden')

  const file = (await GaebFile.findById(String(job.fileId)).lean()) as Record<string, unknown> | null
  if (!file?.bucket || !file?.storageKey) return errorResult('Datei nicht gefunden')

  await GaebImportJob.findByIdAndUpdate(jobId, { status: 'validierung', error: null })

  let rawXml: string
  try {
    const buffer = await getObjectBufferAsync(String(file.bucket), String(file.storageKey))
    rawXml = decodeXmlBuffer(buffer)
  } catch {
    return failJob(jobId, 'Datei konnte nicht geladen werden')
  }

  const settings = await loadGaebSettings()
  const { validation, parsed } = await validateGaeb(rawXml, { strictXsd: settings.strictXsdValidation })

  // Bei ungültiger Grundstruktur abbrechen
  if (!validation.valid || !parsed) {
    await GaebImportJob.findByIdAndUpdate(jobId, {
      status: validation.valid ? 'validiert' : 'fehler',
      validation,
      version: validation.detectedVersion ?? null,
      phase: validation.detectedPhase ?? null,
      error: validation.valid ? null : 'Validierung fehlgeschlagen',
    })
    return {
      ok: validation.valid,
      status: validation.valid ? 'validiert' : 'fehler',
      validation,
    }
  }

  // Parsen
  try {
    const boq = parseGaeb({
      parsed,
      importJobId: jobId,
      version: validation.detectedVersion ?? 'unbekannt',
      phase: validation.detectedPhase ?? 'unbekannt',
    })

    // Vorherige BoQ dieses Jobs ersetzen (Idempotenz)
    await GaebBillOfQuantities.deleteMany({ importJobId: jobId })
    const saved = await GaebBillOfQuantities.create({
      importJobId: jobId,
      version: boq.version,
      phase: boq.phase,
      projectName: boq.projectName ?? '',
      currency: boq.currency,
      netSum: boq.netSum ?? null,
      grossSum: boq.grossSum ?? null,
      lots: boq.lots,
      positionCount: boq.positionCount,
    })

    await GaebImportJob.findByIdAndUpdate(jobId, {
      status: 'geparst',
      validation,
      version: boq.version,
      phase: boq.phase,
      boqId: String(saved._id),
      error: null,
    })

    return {
      ok: true,
      status: 'geparst',
      validation,
      boqId: String(saved._id),
      positionCount: boq.positionCount,
    }
  } catch (e) {
    return failJob(jobId, e instanceof Error ? e.message : 'Parsing fehlgeschlagen')
  }
}

function errorResult(message: string): GaebImportRunResult {
  return {
    ok: false,
    status: 'fehler',
    validation: { valid: false, errors: [{ code: 'RUN', message, severity: 'fehler' }], warnings: [], checkedAt: new Date().toISOString() },
    error: message,
  }
}

async function failJob(jobId: string, message: string): Promise<GaebImportRunResult> {
  await GaebImportJob.findByIdAndUpdate(jobId, { status: 'fehler', error: message })
  return errorResult(message)
}
