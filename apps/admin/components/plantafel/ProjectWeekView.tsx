'use client'

import { useMemo, useState } from 'react'
import { format, getISOWeek, isSameDay } from 'date-fns'
import { de } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Upload } from 'lucide-react'

import EventTooltip from './EventTooltip'
import { SHIFT_DAY_COLOR, SHIFT_NIGHT_COLOR } from '@/lib/plantafel/projectColors'
import {
  getHolidayTitlesByDay,
  getProjectBarSpan,
  getWeekDays,
  sortProjectEvents,
  toDayKey,
  type ProjectBarSpan,
} from '@/lib/plantafel/projectWeekLayout'
import type { PlantafelEvent } from './types'

// Erste Spalte: KW-Spalte (wie das Zeitraster-Gutter), danach 7 Tagesspalten.
const GRID_TEMPLATE = '48px repeat(7, minmax(0, 1fr))'
const FALLBACK_BAR_COLOR = '#6366f1' // projekt_plan-Farbe der Legende

const WEEKEND_START_INDEX = 5 // Sa/So bei Wochenbeginn Montag

interface ProjectWeekViewProps {
  date: Date
  events: PlantafelEvent[]
  onProjectClick: (event: PlantafelEvent) => void
  onProjectFileDrop?: (event: PlantafelEvent, files: File[]) => void
}

interface ProjectWeekBarProps {
  event: PlantafelEvent
  span: ProjectBarSpan
  onClick: (event: PlantafelEvent) => void
  onFileDrop?: (event: PlantafelEvent, files: File[]) => void
}

/**
 * Ein Projekt-Laufzeitbalken über die Tagesspalten der Woche — gleiche
 * Optik wie die "geplant"-Balken im Kalender (Schraffur + gestrichelte
 * Kante in Statusfarbe) inkl. Schicht-Badges und Dokumenten-Drop.
 */
function ProjectWeekBar({ event, span, onClick, onFileDrop }: ProjectWeekBarProps) {
  const [fileOver, setFileOver] = useState(false)
  const color = event.color || FALLBACK_BAR_COLOR
  const counts = event.shiftCounts
  const canDropFiles = Boolean(onFileDrop && event.projektId)

  return (
    <button
      type="button"
      className={`min-w-0 rounded text-left transition-shadow ${
        fileOver ? 'ring-2 ring-blue-500 ring-inset bg-blue-500/20' : ''
      }`}
      style={{
        gridColumn: `${span.startIndex + 2} / ${span.endIndex + 3}`,
        backgroundImage: `repeating-linear-gradient(45deg, ${color}33, ${color}33 6px, ${color}1a 6px, ${color}1a 12px)`,
        border: `1px dashed ${color}`,
        color,
        minHeight: '38px',
      }}
      onClick={() => onClick(event)}
      onDragOver={(e) => {
        if (!canDropFiles || !Array.from(e.dataTransfer?.types || []).includes('Files')) return
        e.preventDefault()
        e.stopPropagation()
        if (!fileOver) setFileOver(true)
      }}
      onDragLeave={(e) => {
        if (!canDropFiles) return
        e.preventDefault()
        e.stopPropagation()
        setFileOver(false)
      }}
      onDrop={(e) => {
        if (!canDropFiles || !Array.from(e.dataTransfer?.types || []).includes('Files')) return
        e.preventDefault()
        e.stopPropagation()
        setFileOver(false)
        const files = Array.from(e.dataTransfer.files || [])
        if (files.length && onFileDrop) onFileDrop(event, files)
      }}
    >
      <EventTooltip event={event}>
        <span className="flex h-full w-full items-center gap-1.5 px-2 py-1 text-xs leading-tight">
          {fileOver ? (
            <span className="flex w-full items-center justify-center gap-1 text-[11px] font-semibold">
              <Upload className="h-3.5 w-3.5" /> Ablegen
            </span>
          ) : (
            <>
              {span.continuesBefore && <ChevronLeft className="h-3 w-3 shrink-0 opacity-70" />}
              <span className="truncate font-semibold">{event.title}</span>
              <span className="ml-auto flex shrink-0 items-center gap-1">
                {counts && counts.tag > 0 && (
                  <span
                    className="rounded px-1 text-[9px] font-semibold leading-tight text-white"
                    style={{ backgroundColor: SHIFT_DAY_COLOR }}
                    title={`${counts.tag}× Frühschicht (05–12 Uhr)`}
                  >
                    {counts.tag}× Früh
                  </span>
                )}
                {counts && counts.nacht > 0 && (
                  <span
                    className="rounded px-1 text-[9px] font-semibold leading-tight text-white"
                    style={{ backgroundColor: SHIFT_NIGHT_COLOR }}
                    title={`${counts.nacht}× Nachtschicht`}
                  >
                    {counts.nacht}× Nacht
                  </span>
                )}
                {span.continuesAfter && <ChevronRight className="h-3 w-3 shrink-0 opacity-70" />}
              </span>
            </>
          )}
        </span>
      </EventTooltip>
    </button>
  )
}

/**
 * Wochenansicht im Projekt-Modus: Alle Projekte als Laufzeitbalken über die
 * gesamte Kalenderfläche — ohne Zeitraster und ohne Mitarbeiter-Zeiten.
 */
export default function ProjectWeekView({
  date,
  events,
  onProjectClick,
  onProjectFileDrop,
}: ProjectWeekViewProps) {
  const weekDays = useMemo(() => getWeekDays(date), [date])
  const weekStart = weekDays[0]
  const today = new Date()

  const bars = useMemo(() => {
    const projectEvents = sortProjectEvents(events.filter((e) => e.sourceType === 'projekt'))
    return projectEvents.flatMap((event) => {
      const span = getProjectBarSpan(event, weekStart)
      return span ? [{ event, span }] : []
    })
  }, [events, weekStart])

  const holidaysByDay = useMemo(() => getHolidayTitlesByDay(events, weekDays), [events, weekDays])

  return (
    <div className="flex h-full min-w-[600px] flex-col">
      {/* Kopfzeile: KW + Wochentage (Wochenende rot, Heute blau, Feiertage) */}
      <div
        className="grid border-b border-slate-200 pb-1 dark:border-slate-700"
        style={{ gridTemplateColumns: GRID_TEMPLATE }}
      >
        <div className="flex items-center justify-center text-[11px] font-semibold text-slate-500 dark:text-slate-400">
          KW {getISOWeek(weekStart)}
        </div>
        {weekDays.map((day, index) => {
          const isToday = isSameDay(day, today)
          const isWeekendDay = index >= WEEKEND_START_INDEX
          const holidayTitles = holidaysByDay.get(toDayKey(day))
          return (
            <div key={toDayKey(day)} className="min-w-0 px-1 text-center">
              <div
                className={`text-sm font-semibold ${
                  isToday
                    ? 'text-blue-600 dark:text-blue-400'
                    : isWeekendDay
                    ? 'text-red-500'
                    : 'text-slate-700 dark:text-slate-200'
                }`}
              >
                {format(day, 'dd EEE', { locale: de })}
              </div>
              {holidayTitles && (
                <div
                  className="mx-auto max-w-full truncate rounded bg-amber-100 px-1 text-[10px] font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                  title={holidayTitles.join(', ')}
                >
                  {holidayTitles.join(', ')}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Kalenderfläche: Projekte als Balken über die ganze Höhe, ohne Zeitraster */}
      <div className="flex-1 overflow-y-auto">
        <div className="relative min-h-full">
          {/* Hintergrund: durchgehende Tagesspalten mit Wochenend-/Heute-/Feiertags-Tönung */}
          <div
            className="pointer-events-none absolute inset-0 grid"
            style={{ gridTemplateColumns: GRID_TEMPLATE }}
            aria-hidden
          >
            <div className="border-r border-slate-200 dark:border-slate-700" />
            {weekDays.map((day, index) => {
              const isToday = isSameDay(day, today)
              const isWeekendDay = index >= WEEKEND_START_INDEX
              const isHoliday = holidaysByDay.has(toDayKey(day))
              const tint = isToday
                ? 'bg-blue-50/70 dark:bg-blue-900/15'
                : isHoliday
                ? 'bg-amber-50/70 dark:bg-amber-900/10'
                : isWeekendDay
                ? 'bg-slate-50/80 dark:bg-slate-900/30'
                : ''
              return (
                <div
                  key={toDayKey(day)}
                  className={`border-r border-slate-100 last:border-r-0 dark:border-slate-700/60 ${tint}`}
                />
              )
            })}
          </div>

          {/* Vordergrund: eine Zeile pro Projekt */}
          <div className="relative z-10 flex flex-col gap-1.5 py-2">
            {bars.map(({ event, span }) => (
              <div key={event.id} className="grid" style={{ gridTemplateColumns: GRID_TEMPLATE }}>
                <ProjectWeekBar
                  event={event}
                  span={span}
                  onClick={onProjectClick}
                  onFileDrop={onProjectFileDrop}
                />
              </div>
            ))}
            {bars.length === 0 && (
              <p className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                Keine Projekte in diesem Zeitraum.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
