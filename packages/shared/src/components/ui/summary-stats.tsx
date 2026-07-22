import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * Wiederverwendbarer Kennzahlen-Streifen.
 *
 * Rein präsentational: die Werte werden fertig formatiert übergeben, damit der
 * Streifen in beliebigen Kontexten (Projekte, Zeiterfassung, Projektdetail)
 * eingesetzt werden kann.
 */

export type SummaryStatTone = "blue" | "emerald" | "fuchsia" | "amber" | "slate"

export interface SummaryStat {
  /** Eindeutiges Label, dient gleichzeitig als React-Key. */
  label: string
  value: string | number
  tone?: SummaryStatTone
}

const TONE_CLASSES: Record<SummaryStatTone, { label: string; accent: string }> = {
  blue: {
    label: "text-blue-600 dark:text-blue-400",
    accent: "from-blue-500 via-sky-400 to-cyan-300",
  },
  emerald: {
    label: "text-emerald-600 dark:text-emerald-400",
    accent: "from-emerald-500 via-lime-400 to-green-300",
  },
  fuchsia: {
    label: "text-fuchsia-600 dark:text-fuchsia-400",
    accent: "from-fuchsia-500 via-violet-400 to-purple-300",
  },
  amber: {
    label: "text-amber-600 dark:text-amber-400",
    accent: "from-amber-500 via-orange-400 to-yellow-300",
  },
  slate: {
    label: "text-slate-600 dark:text-slate-400",
    accent: "from-slate-500 via-slate-400 to-slate-300",
  },
}

const DEFAULT_TONE: SummaryStatTone = "slate"

/** Spaltenanzahl folgt der Menge der Kennzahlen, damit keine Lücken entstehen. */
const COLUMN_CLASSES: Record<number, string> = {
  1: "sm:grid-cols-1",
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
  4: "sm:grid-cols-4",
  5: "sm:grid-cols-3 lg:grid-cols-5",
  6: "sm:grid-cols-3 lg:grid-cols-6",
}

export interface SummaryStatsProps {
  stats: SummaryStat[]
  className?: string
}

export function SummaryStats({ stats, className }: SummaryStatsProps) {
  if (stats.length === 0) return null

  const columns = COLUMN_CLASSES[stats.length] ?? "sm:grid-cols-4"

  return (
    <dl className={cn("grid grid-cols-2 gap-3", columns, className)}>
      {stats.map((stat) => {
        const tone = TONE_CLASSES[stat.tone ?? DEFAULT_TONE]
        return (
          <div key={stat.label}>
            <dt className={cn("text-[11px] font-semibold uppercase tracking-[0.18em]", tone.label)}>
              {stat.label}
            </dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums text-slate-900 dark:text-white">
              {stat.value}
            </dd>
            <div className={cn("mt-2 h-1 rounded-full bg-gradient-to-r", tone.accent)} />
          </div>
        )
      })}
    </dl>
  )
}

export default SummaryStats
