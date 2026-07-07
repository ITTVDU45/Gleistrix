'use client'

import { useState } from 'react'
import { Loader2, CheckCircle2, AlertTriangle } from 'lucide-react'
import GaebUploadDropzone from './GaebUploadDropzone'
import GaebBoqPreview from './GaebBoqPreview'
import { GaebApi, type GaebUploadResult } from '@/lib/api/gaeb'
import type { GaebBillOfQuantities, GaebValidationResult } from '@/types/gaeb'

interface GaebImportPanelProps {
  /** Projektbindung – erzeugt eine projektbezogene Ausschreibung. */
  projectId?: string
  /** Callback nach erfolgreichem Import (Parse). Liefert BoQ + Upload-Infos. */
  onImported?: (result: { boq: GaebBillOfQuantities | null; upload: GaebUploadResult }) => void
}

type Phase = 'idle' | 'uploading' | 'validating' | 'done' | 'error'

/**
 * Wiederverwendbarer GAEB-Import: Upload → automatische Validierung/Parsing →
 * Inline-Vorschau. Optional projektgebunden. Nutzbar in Projekt-Anlage und
 * Projektdokumente-Popup.
 */
export default function GaebImportPanel({ projectId, onImported }: GaebImportPanelProps) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [validation, setValidation] = useState<GaebValidationResult | null>(null)
  const [boq, setBoq] = useState<GaebBillOfQuantities | null>(null)
  const [error, setError] = useState('')

  const handleUploaded = async (upload: GaebUploadResult) => {
    setPhase('validating')
    setError('')
    setValidation(null)
    setBoq(null)
    try {
      const res = await GaebApi.imports.validate(upload.importJobId)
      setValidation(res.data.validation)
      if (res.data.ok) {
        const detail = await GaebApi.imports.get(upload.importJobId)
        setBoq(detail.data.boq)
        setPhase('done')
        onImported?.({ boq: detail.data.boq, upload })
      } else {
        setPhase('error')
        setError('Validierung fehlgeschlagen – Datei entspricht nicht der erwarteten GAEB-Struktur.')
      }
    } catch (e) {
      setPhase('error')
      setError(e instanceof Error ? e.message : 'Import fehlgeschlagen')
    }
  }

  return (
    <div className="space-y-3">
      <GaebUploadDropzone
        projectId={projectId}
        onUploaded={(u) => { setPhase('uploading'); handleUploaded(u) }}
        disabled={phase === 'validating'}
      />

      {phase === 'validating' && (
        <p className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          <Loader2 className="h-4 w-4 animate-spin" /> GAEB-Datei wird validiert und geparst…
        </p>
      )}

      {error && (
        <p className="flex items-center gap-1.5 text-sm text-red-600 dark:text-red-400">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
        </p>
      )}

      {validation && validation.warnings.length > 0 && (
        <ul className="space-y-1 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
          {validation.warnings.map((w, i) => (
            <li key={i}>• {w.message}</li>
          ))}
        </ul>
      )}

      {phase === 'done' && boq && (
        <div className="space-y-3">
          <p className="flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4" />
            {boq.positionCount} Positionen erkannt{projectId ? ' und dem Projekt zugeordnet' : ''}.
          </p>
          <GaebBoqPreview boq={boq} />
        </div>
      )}
    </div>
  )
}
