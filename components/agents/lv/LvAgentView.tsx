'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Upload, FileSpreadsheet, AlertTriangle, ArrowRight } from 'lucide-react'
import { toneStyle, type Tone } from '@/components/shared/toneStyles'
import { AgentsApi } from '@/lib/api/agents'
import type { LvDocument, LvPosition, LvRisk, LvNextStep, LvRiskLevel } from '@/types/agents'

const RISK_TONE: Record<LvRiskLevel, Tone> = {
  niedrig: 'default',
  mittel: 'warning',
  hoch: 'critical',
}

function formatPrice(value?: number): string {
  if (value === undefined) return '–'
  return value.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
}

export default function LvAgentView() {
  const [documents, setDocuments] = useState<LvDocument[]>([])
  const [positions, setPositions] = useState<LvPosition[]>([])
  const [risks, setRisks] = useState<LvRisk[]>([])
  const [nextSteps, setNextSteps] = useState<LvNextStep[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      AgentsApi.getLvDocuments(),
      AgentsApi.getLvPositions(),
      AgentsApi.getLvRisks(),
      AgentsApi.getLvNextSteps(),
    ])
      .then(([docs, pos, rsk, steps]) => {
        if (cancelled) return
        setDocuments(docs)
        setPositions(pos)
        setRisks(rsk)
        setNextSteps(steps)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="space-y-5">
      {/* Upload/Import-Platzhalter */}
      <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <CardContent className="p-5">
          <h3 className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-100">LV-Dokument importieren</h3>
          <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-8 text-center dark:border-slate-600 dark:bg-slate-800/50">
            <Upload className="mb-2 h-8 w-8 text-slate-400" />
            <p className="text-sm text-slate-600 dark:text-slate-300">
              LV-Datei hierher ziehen oder <span className="text-blue-600 underline">durchsuchen</span>
            </p>
            <p className="mt-1 text-xs text-slate-400">PDF, GAEB (.d81/.d83), Excel – Platzhalter, Import folgt</p>
            <Button variant="outline" size="sm" className="mt-4 gap-1" disabled>
              <Upload className="h-4 w-4" /> Import (in Vorbereitung)
            </Button>
          </div>

          {documents.length > 0 && (
            <ul className="mt-4 space-y-2">
              {documents.map((doc) => (
                <li
                  key={doc.id}
                  className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700"
                >
                  <span className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                    <FileSpreadsheet className="h-4 w-4 text-slate-400" />
                    {doc.name}
                  </span>
                  <span className="text-xs text-slate-400">{doc.positionen} Positionen</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Erkannte Positionen */}
      <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <CardContent className="p-5">
          <h3 className="mb-4 text-sm font-semibold text-slate-800 dark:text-slate-100">Erkannte Positionen</h3>
          {isLoading ? (
            <div className="h-24 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-700/40" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    <th className="pb-2 font-medium">OZ</th>
                    <th className="pb-2 font-medium">Bezeichnung</th>
                    <th className="pb-2 font-medium text-right">Menge</th>
                    <th className="pb-2 font-medium">Einheit</th>
                    <th className="pb-2 font-medium text-right">EP</th>
                    <th className="pb-2 font-medium">Anforderung</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {positions.map((p) => (
                    <tr key={p.id}>
                      <td className="py-2.5 pr-3 font-mono text-xs text-slate-500">{p.position}</td>
                      <td className="py-2.5 pr-3 text-slate-800 dark:text-slate-100">{p.bezeichnung}</td>
                      <td className="py-2.5 pr-3 text-right tabular-nums text-slate-700 dark:text-slate-200">
                        {p.menge.toLocaleString('de-DE')}
                      </td>
                      <td className="py-2.5 pr-3 text-slate-600 dark:text-slate-300">{p.einheit}</td>
                      <td className="py-2.5 pr-3 text-right tabular-nums text-slate-700 dark:text-slate-200">
                        {formatPrice(p.einheitspreis)}
                      </td>
                      <td className="py-2.5 text-xs text-slate-500 dark:text-slate-400">{p.anforderung ?? '–'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Risiken / Hinweise */}
        <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <CardContent className="p-5">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
              <AlertTriangle className="h-4 w-4 text-amber-500" /> Risiken &amp; Hinweise
            </h3>
            <ul className="space-y-3">
              {risks.map((r) => {
                const styles = toneStyle(RISK_TONE[r.level])
                return (
                  <li key={r.id} className="flex items-start gap-3">
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${styles.bar}`} />
                    <div>
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{r.titel}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{r.hinweis}</p>
                    </div>
                  </li>
                )
              })}
            </ul>
          </CardContent>
        </Card>

        {/* Empfohlene nächste Schritte */}
        <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <CardContent className="p-5">
            <h3 className="mb-4 text-sm font-semibold text-slate-800 dark:text-slate-100">
              Empfohlene nächste Schritte
            </h3>
            <ul className="space-y-3">
              {nextSteps.map((step) => (
                <li key={step.id} className="flex items-start gap-3">
                  <span className="mt-0.5 rounded-lg bg-blue-50 p-1 text-blue-600 ring-1 ring-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:ring-blue-800">
                    <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{step.titel}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{step.beschreibung}</p>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-slate-400 dark:text-slate-500">
        Platzhalter: LV-Import (PDF/GAEB), automatische Positionsextraktion und Anbindung an Ausschreibungs-/
        Auftragssysteme folgen in einem späteren Ausbau.
      </p>
    </div>
  )
}
