'use client'

import { useState } from 'react'
import { FileCode2, Sparkles, Link2, Loader2, AlertTriangle, FileUp } from 'lucide-react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import ProjectCreateForm from './ProjectCreateForm'
import GaebImportPanel from './gaeb/GaebImportPanel'
import { useGaebAccess } from './gaeb/useGaebAccess'
import { GaebApi } from '@/lib/api/gaeb'
import type { Project } from '../types'

type ProjectPrefill = Partial<Omit<Project, 'id' | 'mitarbeiterZeiten'>>

interface ProjectCreateWithGaebProps {
  onSuccess: () => void
  onCancel: () => void
  initialValues?: ProjectPrefill
}

/**
 * Drop-in für ProjectCreateForm mit optionaler GAEB-Vorbefüllung (admin-only).
 * Ein importiertes GAEB-LV befüllt den Projektnamen vor; die vollständige
 * Projektzuordnung des LVs erfolgt anschließend über das Projektdokumente-Popup.
 */
export default function ProjectCreateWithGaeb({ onSuccess, onCancel, initialValues }: ProjectCreateWithGaebProps) {
  const { isGaebAdmin } = useGaebAccess()
  const [showGaeb, setShowGaeb] = useState(false)
  const [prefill, setPrefill] = useState<ProjectPrefill>({})
  const [formKey, setFormKey] = useState(0)
  const [pendingImportJobId, setPendingImportJobId] = useState<string | null>(null)

  // Leistungsanfrage (KI-Vorbefüllung aus Link/Text)
  const [showRequest, setShowRequest] = useState(false)
  const [reqUrl, setReqUrl] = useState('')
  const [reqText, setReqText] = useState('')
  const [showTextFallback, setShowTextFallback] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [reqError, setReqError] = useState('')
  const [reqExtra, setReqExtra] = useState<{ summe?: string; aufgaben?: string; ansprechpartner?: string } | null>(null)

  const applyExtracted = (json: { data?: ProjectPrefill; extra?: typeof reqExtra }) => {
    const data = (json.data || {}) as ProjectPrefill
    const merged: ProjectPrefill = {}
    for (const [k, v] of Object.entries(data)) {
      if (typeof v === 'string' && v.trim()) (merged as Record<string, unknown>)[k] = v.trim()
    }
    setPrefill((prev) => ({ ...prev, ...merged }))
    setFormKey((k) => k + 1)
    setReqExtra(json.extra || null)
    setShowRequest(false)
  }

  const runAnalyze = async (fetchInit: RequestInit) => {
    if (isAnalyzing) return
    setIsAnalyzing(true)
    setReqError('')
    setReqExtra(null)
    try {
      const res = await fetch('/api/projects/prefill-from-request', { credentials: 'include', method: 'POST', ...fetchInit })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.success) {
        setReqError(json?.error || 'Auswertung fehlgeschlagen.')
        if (json?.error && /login|browser geladen/i.test(String(json.error))) setShowTextFallback(true)
        return
      }
      applyExtracted(json)
    } catch {
      setReqError('Netzwerkfehler bei der Auswertung.')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const analyzeRequest = () => {
    const body = reqText.trim() ? { text: reqText.trim() } : reqUrl.trim() ? { url: reqUrl.trim() } : null
    if (!body) return
    runAnalyze({ headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  }

  const analyzePdf = (file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    runAnalyze({ body: fd })
  }

  const handleImported = ({ boq, upload }: { boq: { projectName?: string } | null; upload: { importJobId: string } }) => {
    setPendingImportJobId(upload.importJobId)
    if (boq?.projectName) {
      setPrefill({ name: boq.projectName })
      setFormKey((k) => k + 1) // Remount, damit initialValues greifen
      setShowGaeb(false)
    }
  }

  // Nach erfolgreicher Projektanlage: importiertes LV automatisch verknüpfen
  const handleCreated = async (createdProjectId?: string) => {
    if (pendingImportJobId && createdProjectId) {
      try {
        await GaebApi.imports.assign(pendingImportJobId, createdProjectId)
      } catch {
        /* Verknüpfung best-effort; LV bleibt als globaler Import erhalten */
      }
    }
    onSuccess()
  }

  return (
    <div className="space-y-4">
      {isGaebAdmin && (
        <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-slate-800 dark:text-slate-100">Aus GAEB-LV vorbefüllen</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Optional: LV importieren, um den Projektnamen zu übernehmen.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowGaeb((s) => !s)}>
              <FileCode2 className="mr-1 h-4 w-4" /> {showGaeb ? 'Ausblenden' : 'GAEB-LV importieren'}
            </Button>
          </div>
          {showGaeb && (
            <div className="mt-3">
              <GaebImportPanel onImported={handleImported} />
            </div>
          )}
          {prefill.name && (
            <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400">
              Projektname „{prefill.name}" aus GAEB übernommen – bitte prüfen und restliche Felder ergänzen.
            </p>
          )}
        </div>
      )}

      {/* Aus Leistungsanfrage vorbefüllen (KI) */}
      <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-medium text-slate-800 dark:text-slate-100">Aus Leistungsanfrage vorbefüllen (KI)</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Link, PDF oder Seitentext der Leistungsanfrage – relevante Felder werden automatisch übernommen.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowRequest((s) => !s)}>
            <Sparkles className="mr-1 h-4 w-4" /> {showRequest ? 'Ausblenden' : 'Leistungsanfrage'}
          </Button>
        </div>

        {showRequest && (
          <div className="mt-3 space-y-2">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Link2 className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={reqUrl}
                  onChange={(e) => setReqUrl(e.target.value)}
                  placeholder="https://…/leistungsanfrage"
                  className="pl-8"
                  disabled={isAnalyzing}
                />
              </div>
              <Button size="sm" onClick={analyzeRequest} disabled={isAnalyzing || (!reqUrl.trim() && !reqText.trim())}>
                {isAnalyzing ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1 h-4 w-4" />}
                Auswerten
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <label className={`inline-flex cursor-pointer items-center gap-1 text-xs text-slate-600 hover:underline dark:text-slate-300 ${isAnalyzing ? 'pointer-events-none opacity-60' : ''}`}>
                <FileUp className="h-3.5 w-3.5" /> PDF hochladen
                <input
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  disabled={isAnalyzing}
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) analyzePdf(f)
                    e.target.value = ''
                  }}
                />
              </label>
              <span className="text-xs text-slate-300 dark:text-slate-600">·</span>
              <button
                type="button"
                onClick={() => setShowTextFallback((s) => !s)}
                className="text-xs text-slate-500 underline-offset-2 hover:underline dark:text-slate-400"
              >
                {showTextFallback ? 'Text-Eingabe ausblenden' : 'Seite Login-geschützt? Seitentext einfügen'}
              </button>
            </div>

            {showTextFallback && (
              <textarea
                value={reqText}
                onChange={(e) => setReqText(e.target.value)}
                placeholder="Kopierten Seitentext der Leistungsanfrage hier einfügen…"
                rows={4}
                disabled={isAnalyzing}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            )}

            {reqError && (
              <p className="flex items-start gap-1.5 text-xs text-red-600 dark:text-red-400">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {reqError}
              </p>
            )}
          </div>
        )}

        {reqExtra && (reqExtra.summe || reqExtra.aufgaben) && (
          <div className="mt-2 rounded-lg bg-slate-50 p-2 text-xs text-slate-600 dark:bg-slate-800/50 dark:text-slate-300">
            <p className="font-medium text-emerald-600 dark:text-emerald-400">Felder übernommen – bitte prüfen.</p>
            {reqExtra.summe && <p className="mt-1"><span className="font-medium">Summe:</span> {reqExtra.summe}</p>}
            {reqExtra.aufgaben && <p className="mt-0.5"><span className="font-medium">Aufgaben:</span> {reqExtra.aufgaben}</p>}
          </div>
        )}
      </div>

      <ProjectCreateForm
        key={formKey}
        onSuccess={handleCreated}
        onCancel={onCancel}
        initialValues={{ ...initialValues, ...prefill }}
      />
    </div>
  )
}
