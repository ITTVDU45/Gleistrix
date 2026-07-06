'use client'

import React from 'react'
import { Card, CardContent } from './ui/card'
import { Layers, Sparkles } from 'lucide-react'
import {
  aggregateHoursByFunction,
  formatFunctionHours,
  type HoursByFunctionEntry,
} from '@/lib/timeEntry/hoursByFunction'

interface HoursByFunctionCardProps {
  timeEntries: HoursByFunctionEntry[]
  title?: string
  className?: string
}

/**
 * Wiederverwendbare KPI-Karte: Stunden pro Funktion + Extra-Stunden.
 * Nutzbar in Zeiterfassung, Projekte, Projektdetail und Projektliste —
 * erwartet Einträge in Billing-Row-Form (funktion, stunden, extra, ...).
 */
export default function HoursByFunctionCard({
  timeEntries,
  title = 'Stunden pro Funktion & Extra',
  className = '',
}: HoursByFunctionCardProps) {
  const { rows, totalStunden, totalExtra } = React.useMemo(
    () => aggregateHoursByFunction(timeEntries),
    [timeEntries]
  )

  return (
    <Card
      className={`overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/70 ring-1 ring-white dark:border-slate-700 dark:bg-slate-800 dark:ring-slate-700 ${className}`}
    >
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl p-3 ring-1 bg-indigo-50 ring-indigo-100 dark:bg-indigo-900/30 dark:ring-indigo-800">
              <Layers className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-400">
              {title}
            </p>
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-amber-50 dark:bg-amber-900/20 px-3 py-1.5">
            <Sparkles className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
              Extra gesamt: {formatFunctionHours(totalExtra)}
            </span>
          </div>
        </div>

        {rows.length > 0 ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  <th className="pb-2 font-medium">Funktion</th>
                  <th className="pb-2 font-medium text-right">Stunden</th>
                  <th className="pb-2 font-medium text-right">Extra</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.funktion}
                    className="border-t border-slate-100 dark:border-slate-700/60"
                  >
                    <td className="py-1.5 text-slate-800 dark:text-slate-200">
                      <span className="inline-flex items-center gap-2">
                        <span className="uppercase">{row.funktion}</span>
                        <span className="text-xs text-slate-400 dark:text-slate-500">
                          ({row.eintraege})
                        </span>
                      </span>
                    </td>
                    <td className="py-1.5 text-right font-semibold text-slate-900 dark:text-white tabular-nums">
                      {formatFunctionHours(row.stunden)}
                    </td>
                    <td className="py-1.5 text-right text-amber-700 dark:text-amber-400 tabular-nums">
                      {row.extra > 0 ? formatFunctionHours(row.extra) : '–'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200 dark:border-slate-600">
                  <td className="pt-2 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                    Gesamt
                  </td>
                  <td className="pt-2 text-right font-bold text-slate-900 dark:text-white tabular-nums">
                    {formatFunctionHours(totalStunden)}
                  </td>
                  <td className="pt-2 text-right font-bold text-amber-700 dark:text-amber-400 tabular-nums">
                    {totalExtra > 0 ? formatFunctionHours(totalExtra) : '–'}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
            Keine Zeiteinträge im gewählten Zeitraum.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
