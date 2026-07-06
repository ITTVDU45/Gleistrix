'use client'

import { Card, CardContent } from '@/components/ui/card'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import DynamicIcon from '@/components/shared/DynamicIcon'
import { toneStyle } from '@/components/shared/toneStyles'
import type { ReportKpiCard as ReportKpiCardData } from '@/types/reports'

interface ReportKpiCardProps {
  data: ReportKpiCardData
}

export default function ReportKpiCard({ data }: ReportKpiCardProps) {
  const styles = toneStyle(data.tone)
  const TrendIcon = data.trend === 'up' ? TrendingUp : data.trend === 'down' ? TrendingDown : Minus

  return (
    <Card className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
              {data.label}
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
              {data.value}
              {data.unit ? <span className="ml-1 text-sm font-medium text-slate-400">{data.unit}</span> : null}
            </p>
            {data.sub && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{data.sub}</p>}
            {data.trend && data.trendValue && (
              <p className={`mt-1 inline-flex items-center gap-1 text-xs font-medium ${styles.accent}`}>
                <TrendIcon className="h-3.5 w-3.5" />
                {data.trendValue}
              </p>
            )}
          </div>
          <div className={`shrink-0 rounded-2xl p-2.5 ring-1 ${styles.chip}`}>
            <DynamicIcon name={data.icon} className={`h-5 w-5 ${styles.accent}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
