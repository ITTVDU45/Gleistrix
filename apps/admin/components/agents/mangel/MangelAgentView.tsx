'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { toneStyle, type Tone } from '@/components/shared/toneStyles'
import { AgentsApi } from '@/lib/api/agents'
import type {
  MangelItem,
  MangelSeverity,
  MangelStatus,
  MangelKategorie,
} from '@/types/agents'

const SEVERITY_META: Record<MangelSeverity, { label: string; tone: Tone }> = {
  niedrig: { label: 'Niedrig', tone: 'default' },
  mittel: { label: 'Mittel', tone: 'info' },
  hoch: { label: 'Hoch', tone: 'warning' },
  kritisch: { label: 'Kritisch', tone: 'critical' },
}

const STATUS_META: Record<MangelStatus, { label: string; tone: Tone }> = {
  offen: { label: 'Offen', tone: 'warning' },
  in_pruefung: { label: 'In Prüfung', tone: 'info' },
  behoben: { label: 'Behoben', tone: 'positive' },
  ignoriert: { label: 'Ignoriert', tone: 'default' },
}

const KATEGORIE_LABELS: Record<MangelKategorie, string> = {
  material_beschaedigt: 'Material beschädigt',
  bestand_fehlt: 'Bestand fehlt',
  fehlerhafte_ausgabe: 'Fehlerhafte Ausgabe',
  fehlerhafte_ruecknahme: 'Fehlerhafte Rücknahme',
  wartung_faellig: 'Wartung fällig',
  sonstiges: 'Sonstiges',
}

function Pill({ label, tone }: { label: string; tone: Tone }) {
  const styles = toneStyle(tone)
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${styles.badge}`}>{label}</span>
}

export default function MangelAgentView() {
  const [items, setItems] = useState<MangelItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    AgentsApi.getMangelItems()
      .then((data) => {
        if (!cancelled) setItems(data)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const offen = items.filter((i) => i.status === 'offen')
  const inPruefung = items.filter((i) => i.status === 'in_pruefung')

  return (
    <div className="space-y-5">
      {/* Zusammenfassung offene Prüfungen */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Offene Mängel</p>
            <p className="mt-1 text-2xl font-bold text-amber-600 dark:text-amber-400">{offen.length}</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Offene Prüfungen</p>
            <p className="mt-1 text-2xl font-bold text-blue-600 dark:text-blue-400">{inPruefung.length}</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Kritisch</p>
            <p className="mt-1 text-2xl font-bold text-red-600 dark:text-red-400">
              {items.filter((i) => i.severity === 'kritisch').length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Erkannte Mängel */}
      <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <CardContent className="p-5">
          <h3 className="mb-4 text-sm font-semibold text-slate-800 dark:text-slate-100">Erkannte Mängel</h3>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-14 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-700/40" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">Keine Mängel erkannt.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    <th className="pb-2 font-medium">Mangel</th>
                    <th className="pb-2 font-medium">Kategorie</th>
                    <th className="pb-2 font-medium">Schwere</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium">Empfohlene Aktion</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {items.map((item) => (
                    <tr key={item.id} className="align-top">
                      <td className="py-3 pr-3">
                        <p className="font-medium text-slate-800 dark:text-slate-100">{item.titel}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {item.artikel}
                          {item.artikelnummer ? ` · Nr. ${item.artikelnummer}` : ''}
                        </p>
                      </td>
                      <td className="py-3 pr-3 text-slate-600 dark:text-slate-300">{KATEGORIE_LABELS[item.kategorie]}</td>
                      <td className="py-3 pr-3">
                        <Pill label={SEVERITY_META[item.severity].label} tone={SEVERITY_META[item.severity].tone} />
                      </td>
                      <td className="py-3 pr-3">
                        <Pill label={STATUS_META[item.status].label} tone={STATUS_META[item.status].tone} />
                      </td>
                      <td className="py-3 text-slate-600 dark:text-slate-300">{item.empfohleneAktion ?? '–'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-slate-400 dark:text-slate-500">
        Platzhalter: Automatische Erkennung, KI-Auswertung und Verknüpfung mit Lagerbewegungen folgen in einem
        späteren Ausbau.
      </p>
    </div>
  )
}
