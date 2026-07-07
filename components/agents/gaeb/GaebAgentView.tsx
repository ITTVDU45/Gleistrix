'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, AlertTriangle, Sparkles, Boxes, ArrowRight, FileCode2, Send } from 'lucide-react'
import GaebImportPanel from '@/components/gaeb/GaebImportPanel'
import { toneStyle, type Tone } from '@/components/shared/toneStyles'
import { GaebApi, type GaebImportListItem } from '@/lib/api/gaeb'
import type { GaebAgentAnalysis, GaebRiskLevel } from '@/types/gaeb'

const RISK_TONE: Record<GaebRiskLevel, Tone> = { niedrig: 'default', mittel: 'warning', hoch: 'critical' }

export default function GaebAgentView() {
  const [imports, setImports] = useState<GaebImportListItem[]>([])
  const [selectedId, setSelectedId] = useState<string>('')
  const [analysis, setAnalysis] = useState<GaebAgentAnalysis | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [error, setError] = useState('')

  const loadImports = useCallback(async () => {
    try {
      const res = await GaebApi.imports.list()
      const analysable = res.data.filter((i) => i.status === 'geparst' || i.status === 'zugeordnet')
      setImports(analysable)
    } catch {
      setImports([])
    }
  }, [])

  useEffect(() => {
    loadImports()
  }, [loadImports])

  const runAnalysis = useCallback(async (jobId: string) => {
    if (!jobId) return
    setIsAnalyzing(true)
    setError('')
    setAnalysis(null)
    try {
      const res = await GaebApi.imports.analyze(jobId)
      setAnalysis(res.data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Analyse fehlgeschlagen')
    } finally {
      setIsAnalyzing(false)
    }
  }, [])

  return (
    <div className="space-y-5">
      {/* Upload + Auswahl */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-2xl border-slate-200 dark:border-slate-700">
          <CardContent className="p-5">
            <h3 className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-100">GAEB-Datei analysieren</h3>
            <GaebImportPanel
              onImported={({ upload }) => {
                loadImports()
                setSelectedId(upload.importJobId)
                runAnalysis(upload.importJobId)
              }}
            />
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200 dark:border-slate-700">
          <CardContent className="p-5">
            <h3 className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-100">Vorhandenen Import wählen</h3>
            {imports.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Noch keine geparsten Importe. Links eine GAEB-Datei hochladen oder in den Einstellungen importieren.
              </p>
            ) : (
              <div className="space-y-2">
                <select
                  value={selectedId}
                  onChange={(e) => setSelectedId(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                >
                  <option value="">— Import wählen —</option>
                  {imports.map((i) => (
                    <option key={i.importJobId} value={i.importJobId}>
                      {i.originalName}{i.version ? ` (${i.version}${i.phase ? `/${i.phase}` : ''})` : ''}
                    </option>
                  ))}
                </select>
                <Button size="sm" disabled={!selectedId || isAnalyzing} onClick={() => runAnalysis(selectedId)} className="gap-1">
                  {isAnalyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  Analysieren
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {error && (
        <p className="flex items-center gap-1.5 text-sm text-red-600 dark:text-red-400">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
        </p>
      )}

      {isAnalyzing && (
        <p className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          <Loader2 className="h-4 w-4 animate-spin" /> LV wird analysiert…
        </p>
      )}

      {analysis && (
        <div className="space-y-4">
          {/* Zusammenfassung */}
          <Card className="rounded-2xl border-slate-200 bg-blue-50/40 dark:border-slate-700 dark:bg-blue-900/10">
            <CardContent className="flex items-start gap-3 p-5">
              <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">Zusammenfassung</p>
                <p className="mt-0.5 text-sm text-slate-700 dark:text-slate-200">{analysis.summary}</p>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Risiken */}
            <Card className="rounded-2xl border-slate-200 dark:border-slate-700">
              <CardContent className="p-5">
                <h3 className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-100">Risiken &amp; Auffälligkeiten</h3>
                {analysis.risks.length === 0 ? (
                  <p className="text-sm text-emerald-600 dark:text-emerald-400">Keine auffälligen Risiken erkannt.</p>
                ) : (
                  <ul className="space-y-3">
                    {analysis.risks.map((r) => {
                      const s = toneStyle(RISK_TONE[r.level])
                      return (
                        <li key={r.id} className="flex items-start gap-3">
                          <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${s.bar}`} />
                          <div>
                            <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{r.title}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{r.hint}</p>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>

            {/* Fehlende Angaben + Cluster */}
            <div className="space-y-4">
              <Card className="rounded-2xl border-slate-200 dark:border-slate-700">
                <CardContent className="p-5">
                  <h3 className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-100">Fehlende Angaben</h3>
                  {analysis.missingData.length === 0 ? (
                    <p className="text-sm text-emerald-600 dark:text-emerald-400">Keine fehlenden Pflichtangaben.</p>
                  ) : (
                    <ul className="list-inside list-disc space-y-1 text-sm text-slate-600 dark:text-slate-300">
                      {analysis.missingData.map((m, i) => <li key={i}>{m}</li>)}
                    </ul>
                  )}
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-slate-200 dark:border-slate-700">
                <CardContent className="p-5">
                  <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                    <Boxes className="h-4 w-4 text-slate-500" /> Positionen nach Gewerk
                  </h3>
                  <ul className="space-y-1.5">
                    {analysis.clusters.map((c) => (
                      <li key={c.id} className="flex items-center justify-between text-sm">
                        <span className="text-slate-700 dark:text-slate-200">{c.label}</span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                          {c.positionCount}
                        </span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Ressourcen-Vorschläge */}
          {analysis.resourceSuggestions && analysis.resourceSuggestions.length > 0 && (
            <Card className="rounded-2xl border-slate-200 dark:border-slate-700">
              <CardContent className="p-5">
                <h3 className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-100">Ressourcen-Vorschläge</h3>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {analysis.resourceSuggestions.map((s, i) => (
                    <div key={i} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{s.type}</p>
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{s.label}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{s.reason}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Projektanlage-Vorschlag */}
          {analysis.projectDraft && (
            <Card className="rounded-2xl border-slate-200 dark:border-slate-700">
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
                <div className="flex items-center gap-3">
                  <FileCode2 className="h-5 w-5 text-slate-500" />
                  <div>
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100">Projektanlage-Vorschlag</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      „{analysis.projectDraft.name}" · {analysis.projectDraft.positionCount} Positionen
                    </p>
                  </div>
                </div>
                <Button asChild variant="outline" size="sm" className="gap-1">
                  <a href="/projekte?create=1">
                    Projekt anlegen <ArrowRight className="h-4 w-4" />
                  </a>
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Fragen an den Agenten (Platzhalter für spätere LLM-Anbindung) */}
          <Card className="rounded-2xl border-dashed border-slate-300 dark:border-slate-700">
            <CardContent className="p-5">
              <h3 className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-100">Fragen an den Agenten</h3>
              <div className="flex gap-2">
                <input
                  disabled
                  placeholder="Freitext-Frage zum LV (in Vorbereitung)"
                  className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-400 dark:border-slate-700 dark:bg-slate-800/50"
                />
                <Button size="sm" disabled className="gap-1">
                  <Send className="h-4 w-4" /> Senden
                </Button>
              </div>
              <p className="mt-2 text-xs text-slate-400">
                Freitext-Fragen (LLM-Anbindung) folgen; die regelbasierte Analyse oben ist bereits aktiv.
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
