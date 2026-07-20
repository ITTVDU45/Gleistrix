'use client'

import { Card, CardContent } from '@/components/ui/card'
import { toneStyle } from '@/components/shared/toneStyles'
import type { ReportChartData } from '@/types/reports'

interface ReportBarChartProps {
  data: ReportChartData
}

function formatValue(value: number): string {
  return value.toLocaleString('de-DE', { maximumFractionDigits: 2 })
}

/**
 * Leichtgewichtiges, dependency-freies Balkendiagramm (horizontal).
 * Rendert `ReportChartData` – bewusst ohne Chart-Library, um keine neuen
 * Abhängigkeiten einzuführen.
 */
export default function ReportBarChart({ data }: ReportBarChartProps) {
  const max = Math.max(1, ...data.points.map((p) => p.value))

  return (
    <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <CardContent className="p-5">
        <div className="mb-4 flex items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{data.title}</h3>
          {data.unit && <span className="text-xs text-slate-400">{data.unit}</span>}
        </div>
        <div className="space-y-3">
          {data.points.map((point) => {
            const pct = Math.round((point.value / max) * 100)
            const styles = toneStyle(point.tone ?? 'info')
            return (
              <div key={point.label} className="grid grid-cols-[7rem_1fr_auto] items-center gap-3">
                <span className="truncate text-xs font-medium text-slate-600 dark:text-slate-300" title={point.label}>
                  {point.label}
                </span>
                <div className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                  <div
                    className={`h-full rounded-full ${styles.bar} transition-all`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="w-16 text-right text-xs font-semibold tabular-nums text-slate-800 dark:text-slate-100">
                  {formatValue(point.value)}
                </span>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
