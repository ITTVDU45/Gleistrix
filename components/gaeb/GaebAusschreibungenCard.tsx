'use client'

import { useEffect, useState } from 'react'
import { FileCode2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { GaebApi, type GaebAusschreibungListItem } from '@/lib/api/gaeb'

interface GaebAusschreibungenCardProps {
  projectId: string
}

function formatMoney(value: number | null, currency: string): string {
  if (value === null || value === undefined) return '–'
  return value.toLocaleString('de-DE', { style: 'currency', currency: currency || 'EUR' })
}

/**
 * Zeigt die dem Projekt zugeordneten GAEB-Ausschreibungen/LVs. Blendet sich aus,
 * wenn keine vorhanden sind (kein leerer Platzhalter auf der Projektseite).
 */
export default function GaebAusschreibungenCard({ projectId }: GaebAusschreibungenCardProps) {
  const [items, setItems] = useState<GaebAusschreibungListItem[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    GaebApi.ausschreibungen
      .listForProject(projectId)
      .then((res) => {
        if (!cancelled) setItems(res.data)
      })
      .catch(() => {
        if (!cancelled) setItems([])
      })
      .finally(() => {
        if (!cancelled) setLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [projectId])

  if (!loaded || items.length === 0) return null

  return (
    <Card className="bg-white dark:bg-slate-800 border border-[#C0D4DE] dark:border-slate-700">
      <CardContent className="p-6">
        <div className="mb-4 flex items-center gap-2">
          <FileCode2 className="h-5 w-5 text-slate-500" />
          <h3 className="text-xl font-semibold">Ausschreibungen / LV (GAEB)</h3>
        </div>
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/50">
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Version / Phase</th>
                <th className="px-3 py-2 text-right font-medium">Positionen</th>
                <th className="px-3 py-2 text-right font-medium">Nettosumme</th>
                <th className="px-3 py-2 font-medium">Importiert</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {items.map((a) => (
                <tr key={a.id}>
                  <td className="px-3 py-2 text-slate-800 dark:text-slate-100">{a.name}</td>
                  <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                    {a.version ?? '—'}{a.phase ? ` · ${a.phase}` : ''}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{a.positionCount}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatMoney(a.netSum, a.currency)}</td>
                  <td className="px-3 py-2 text-slate-500 dark:text-slate-400">
                    {a.createdAt ? new Date(a.createdAt).toLocaleDateString('de-DE') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
