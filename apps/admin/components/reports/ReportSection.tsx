'use client'

import { Info } from 'lucide-react'
import ReportKpiCard from './ReportKpiCard'
import ReportBarChart from './ReportBarChart'
import ReportCategoryList from './ReportCategoryList'
import type { ReportSectionData } from '@/types/reports'

interface ReportSectionProps {
  data?: ReportSectionData
  isLoading?: boolean
  /** Titel für die Kategorie-/Metrik-Karte */
  categoryTitle?: string
}

/**
 * Generischer Renderer für einen Report-Tab. Zeigt KPIs, Charts, Kategorien
 * und Hinweise datengetrieben an – jeder Tab bleibt dadurch schlank.
 */
export default function ReportSection({ data, isLoading, categoryTitle = 'Verteilung' }: ReportSectionProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
        ))}
      </div>
    )
  }

  if (!data) {
    return (
      <p className="rounded-2xl border border-dashed border-slate-300 py-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
        Keine Daten verfügbar.
      </p>
    )
  }

  const hasSide = (data.categories?.length ?? 0) > 0 || (data.metrics?.length ?? 0) > 0

  return (
    <div className="space-y-5">
      {data.hinweise && data.hinweise.length > 0 && (
        <div className="flex flex-col gap-1.5 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
          {data.hinweise.map((h, i) => (
            <p key={i} className="flex items-center gap-2 text-sm text-amber-800 dark:text-amber-300">
              <Info className="h-4 w-4 shrink-0" /> {h}
            </p>
          ))}
        </div>
      )}

      {data.kpis.length > 0 && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {data.kpis.map((kpi) => (
            <ReportKpiCard key={kpi.id} data={kpi} />
          ))}
        </div>
      )}

      {(data.charts?.length || hasSide) && (
        <div className={`grid gap-5 ${hasSide ? 'lg:grid-cols-3' : 'grid-cols-1'}`}>
          {data.charts && data.charts.length > 0 && (
            <div className={`space-y-5 ${hasSide ? 'lg:col-span-2' : ''}`}>
              {data.charts.map((chart) => (
                <ReportBarChart key={chart.id} data={chart} />
              ))}
            </div>
          )}
          {hasSide && (
            <ReportCategoryList title={categoryTitle} categories={data.categories} metrics={data.metrics} />
          )}
        </div>
      )}
    </div>
  )
}
