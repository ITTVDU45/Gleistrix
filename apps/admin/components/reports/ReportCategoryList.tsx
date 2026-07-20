'use client'

import { Card, CardContent } from '@/components/ui/card'
import { toneStyle } from '@/components/shared/toneStyles'
import type { ReportCategory, ReportMetric } from '@/types/reports'

interface ReportCategoryListProps {
  title: string
  categories?: ReportCategory[]
  metrics?: ReportMetric[]
}

export default function ReportCategoryList({ title, categories, metrics }: ReportCategoryListProps) {
  const hasCategories = categories && categories.length > 0
  const hasMetrics = metrics && metrics.length > 0
  if (!hasCategories && !hasMetrics) return null

  return (
    <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <CardContent className="p-5">
        <h3 className="mb-4 text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</h3>

        {hasCategories && (
          <ul className="space-y-2.5">
            {categories!.map((cat) => {
              const styles = toneStyle(cat.tone)
              return (
                <li key={cat.id} className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                    <span className={`h-2.5 w-2.5 rounded-full ${styles.bar}`} />
                    {cat.label}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${styles.badge}`}>
                    {cat.value.toLocaleString('de-DE')}
                  </span>
                </li>
              )
            })}
          </ul>
        )}

        {hasMetrics && (
          <div className={`space-y-3 ${hasCategories ? 'mt-4 border-t border-slate-100 pt-4 dark:border-slate-700' : ''}`}>
            {metrics!.map((metric) => {
              const styles = toneStyle(metric.tone)
              const pct = metric.total ? Math.min(100, Math.round((metric.value / metric.total) * 100)) : null
              return (
                <div key={metric.id}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-slate-600 dark:text-slate-300">{metric.label}</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-100">
                      {metric.value.toLocaleString('de-DE')}
                      {metric.unit ? ` ${metric.unit}` : ''}
                    </span>
                  </div>
                  {pct !== null && (
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                      <div className={`h-full rounded-full ${styles.bar}`} style={{ width: `${pct}%` }} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
