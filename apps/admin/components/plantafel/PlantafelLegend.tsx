'use client'

import {
  PROJECT_STATUS_COLORS,
  NOT_STARTED_COLOR,
  SHIFT_DAY_COLOR,
  SHIFT_NIGHT_COLOR,
} from '@/lib/plantafel/projectColors'

interface LegendItem {
  label: string
  color: string
  dashed?: boolean
}

const STATUS_ITEMS: LegendItem[] = [
  { label: 'Nicht gestartet', color: NOT_STARTED_COLOR, dashed: true },
  { label: 'Aktiv', color: PROJECT_STATUS_COLORS.aktiv, dashed: true },
  { label: 'Abgeschlossen', color: PROJECT_STATUS_COLORS.abgeschlossen, dashed: true },
  { label: 'Fertiggestellt', color: PROJECT_STATUS_COLORS.fertiggestellt, dashed: true },
  { label: 'Geleistet', color: PROJECT_STATUS_COLORS.geleistet, dashed: true },
  { label: 'Teilw. abgerechnet', color: PROJECT_STATUS_COLORS.teilweise_abgerechnet, dashed: true },
  { label: 'Kein Status', color: PROJECT_STATUS_COLORS['kein Status'], dashed: true },
]

const SHIFT_ITEMS: LegendItem[] = [
  { label: 'Frühschicht (5–12 Uhr)', color: SHIFT_DAY_COLOR },
  { label: 'Nachtschicht', color: SHIFT_NIGHT_COLOR },
]

function Swatch({ color, dashed }: { color: string; dashed?: boolean }) {
  return (
    <span
      className="inline-block h-3 w-4 rounded-sm shrink-0"
      style={
        dashed
          ? { border: `1px dashed ${color}`, backgroundColor: `${color}22` }
          : { backgroundColor: color }
      }
    />
  )
}

export default function PlantafelLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40 px-3 py-2 text-xs">
      <span className="font-semibold text-slate-600 dark:text-slate-300">Laufzeit (Status):</span>
      {STATUS_ITEMS.map((item) => (
        <span key={item.label} className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
          <Swatch color={item.color} dashed={item.dashed} />
          {item.label}
        </span>
      ))}
      <span className="mx-1 h-4 w-px bg-slate-300 dark:bg-slate-600" />
      <span className="font-semibold text-slate-600 dark:text-slate-300">Schicht-Badges:</span>
      {SHIFT_ITEMS.map((item) => (
        <span key={item.label} className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
          <span
            className="rounded px-1 text-[9px] font-semibold text-white"
            style={{ backgroundColor: item.color }}
          >
            {item.label.startsWith('Früh') ? 'Früh' : 'Nacht'}
          </span>
          {item.label}
        </span>
      ))}
    </div>
  )
}
