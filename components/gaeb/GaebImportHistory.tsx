'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Trash2, FileCode2, ShieldCheck, Eye } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { GaebApi, type GaebImportListItem } from '@/lib/api/gaeb'
import { toneStyle, type Tone } from '@/components/shared/toneStyles'
import GaebBoqPreview from './GaebBoqPreview'
import type { GaebImportStatus, GaebBillOfQuantities } from '@/types/gaeb'

const STATUS_META: Record<GaebImportStatus, { label: string; tone: Tone }> = {
  hochgeladen: { label: 'Hochgeladen', tone: 'info' },
  validierung: { label: 'Validierung', tone: 'info' },
  validiert: { label: 'Validiert', tone: 'positive' },
  geparst: { label: 'Geparst', tone: 'positive' },
  zugeordnet: { label: 'Zugeordnet', tone: 'positive' },
  fehler: { label: 'Fehler', tone: 'critical' },
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

interface GaebImportHistoryProps {
  /** Wird erhöht, um ein Neuladen auszulösen (z.B. nach Upload). */
  refreshKey?: number
}

export default function GaebImportHistory({ refreshKey = 0 }: GaebImportHistoryProps) {
  const [items, setItems] = useState<GaebImportListItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [validatingId, setValidatingId] = useState<string | null>(null)
  const [previewBoq, setPreviewBoq] = useState<GaebBillOfQuantities | null>(null)
  const [previewLoadingId, setPreviewLoadingId] = useState<string | null>(null)
  const [previewError, setPreviewError] = useState('')

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await GaebApi.imports.list()
      setItems(res.data)
    } catch {
      setItems([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load, refreshKey])

  const handleDelete = async (id: string) => {
    if (confirmId !== id) {
      setConfirmId(id)
      return
    }
    try {
      await GaebApi.imports.remove(id)
      setConfirmId(null)
      await load()
    } catch {
      setConfirmId(null)
    }
  }

  const handleValidate = async (id: string) => {
    setValidatingId(id)
    try {
      await GaebApi.imports.validate(id)
    } catch {
      /* Status/Fehler wird über Neuladen sichtbar */
    } finally {
      setValidatingId(null)
      await load()
    }
  }

  const handlePreview = async (id: string) => {
    setPreviewLoadingId(id)
    setPreviewError('')
    try {
      const res = await GaebApi.imports.get(id)
      if (res.data.boq) {
        setPreviewBoq(res.data.boq)
      } else {
        setPreviewError('Für diesen Import liegt noch keine geparste Struktur vor. Bitte zuerst „Prüfen".')
        setPreviewBoq(null)
      }
    } catch {
      setPreviewError('Vorschau konnte nicht geladen werden.')
    } finally {
      setPreviewLoadingId(null)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-300 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
        Noch keine GAEB-Importe.
      </p>
    )
  }

  return (
    <>
    {previewError && (
      <p className="mb-2 text-sm text-amber-600 dark:text-amber-400">{previewError}</p>
    )}
    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 dark:bg-slate-800/50">
          <tr className="text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            <th className="px-3 py-2 font-medium">Datei</th>
            <th className="px-3 py-2 font-medium">Größe</th>
            <th className="px-3 py-2 font-medium">Version / Phase</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium">Datum</th>
            <th className="px-3 py-2 text-right font-medium">Aktion</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
          {items.map((item) => {
            const meta = STATUS_META[item.status] ?? STATUS_META.hochgeladen
            const styles = toneStyle(meta.tone)
            return (
              <tr key={item.importJobId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                <td className="px-3 py-2">
                  <span className="flex items-center gap-2 text-slate-800 dark:text-slate-100">
                    <FileCode2 className="h-4 w-4 shrink-0 text-slate-400" />
                    <span className="break-all">{item.originalName}</span>
                  </span>
                </td>
                <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{formatSize(item.sizeBytes)}</td>
                <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                  {item.version ? `${item.version}${item.phase ? ` · ${item.phase}` : ''}` : '—'}
                </td>
                <td className="px-3 py-2">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${styles.badge}`}>
                    {meta.label}
                  </span>
                </td>
                <td className="px-3 py-2 text-slate-500 dark:text-slate-400">
                  {item.createdAt ? new Date(item.createdAt).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => handleValidate(item.importJobId)}
                      disabled={validatingId === item.importJobId}
                      className="inline-flex h-7 items-center justify-center gap-1 rounded-md px-2 text-blue-600 hover:bg-blue-50 disabled:opacity-50 dark:text-blue-400 dark:hover:bg-blue-900/20"
                      title="Prüfen & Parsen"
                    >
                      {validatingId === item.importJobId ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ShieldCheck className="h-4 w-4" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePreview(item.importJobId)}
                      disabled={previewLoadingId === item.importJobId}
                      className="inline-flex h-7 items-center justify-center rounded-md px-2 text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-700"
                      title="Vorschau"
                    >
                      {previewLoadingId === item.importJobId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(item.importJobId)}
                      className="inline-flex h-7 items-center justify-center rounded-md px-2 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                      title="Löschen"
                    >
                      {confirmId === item.importJobId ? <span className="text-xs">Wirklich?</span> : <Trash2 className="h-4 w-4" />}
                    </button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>

    <Dialog open={!!previewBoq} onOpenChange={(o) => { if (!o) setPreviewBoq(null) }}>
      <DialogContent className="max-h-[88vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>GAEB-Vorschau</DialogTitle>
        </DialogHeader>
        {previewBoq && <GaebBoqPreview boq={previewBoq} />}
      </DialogContent>
    </Dialog>
    </>
  )
}
