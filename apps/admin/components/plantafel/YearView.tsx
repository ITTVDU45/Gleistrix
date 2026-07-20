'use client'

import { useMemo } from 'react'
import {
  eachMonthOfInterval,
  endOfMonth,
  startOfMonth,
  startOfWeek,
  addDays,
  isSameMonth,
  isSameDay,
  format,
  startOfYear,
  endOfYear,
  getDay,
  getISOWeek,
} from 'date-fns'
import { de } from 'date-fns/locale'
import type { PlantafelEvent } from './types'

const WEEKDAY_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

const EVENT_TYPE_COLORS: Record<string, string> = {
  einsatz: '#10b981',
  meeting: '#0f766e',
  urlaub: '#fb923c',
  krankheit: '#ef4444',
  feiertag: '#b45309',
  projekt_plan: '#6366f1',
  projekt_ist: '#10b981',
}

interface YearViewProps {
  events: PlantafelEvent[]
  year: Date
  onMonthClick?: (date: Date) => void
  onDayClick?: (date: Date) => void
}

export default function YearView({ events, year, onMonthClick, onDayClick }: YearViewProps) {
  const months = useMemo(
    () => eachMonthOfInterval({ start: startOfYear(year), end: endOfYear(year) }),
    [year]
  )

  const eventsByDay = useMemo(() => {
    const map = new Map<string, PlantafelEvent[]>()
    const MAX_SPAN_DAYS = 400
    for (const event of events) {
      // Mehrtages-Events (z.B. Projektlaufzeit, Urlaub) auf alle betroffenen Tage verteilen
      let cursor = new Date(event.start)
      const last = event.end instanceof Date ? event.end : new Date(event.end)
      let guard = 0
      while (cursor <= last && guard < MAX_SPAN_DAYS) {
        const key = format(cursor, 'yyyy-MM-dd')
        const existing = map.get(key) || []
        existing.push(event)
        map.set(key, existing)
        cursor = addDays(cursor, 1)
        guard += 1
      }
    }
    return map
  }, [events])

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {months.map((month) => (
        <MonthCard
          key={month.toISOString()}
          month={month}
          eventsByDay={eventsByDay}
          onMonthClick={onMonthClick}
          onDayClick={onDayClick}
        />
      ))}
    </div>
  )
}

interface MonthCardProps {
  month: Date
  eventsByDay: Map<string, PlantafelEvent[]>
  onMonthClick?: (date: Date) => void
  onDayClick?: (date: Date) => void
}

function MonthCard({ month, eventsByDay, onMonthClick, onDayClick }: MonthCardProps) {
  const weeks = useMemo(() => {
    const mStart = startOfMonth(month)
    const mEnd = endOfMonth(month)
    const calStart = startOfWeek(mStart, { weekStartsOn: 1 })

    const rows: Date[][] = []
    let current = calStart

    while (current <= mEnd || rows.length < 6) {
      const week: Date[] = []
      for (let i = 0; i < 7; i++) {
        week.push(current)
        current = addDays(current, 1)
      }
      rows.push(week)
      if (rows.length >= 6) break
    }
    return rows
  }, [month])

  const today = new Date()

  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3">
      <button
        onClick={() => onMonthClick?.(month)}
        className="text-sm font-semibold text-slate-900 dark:text-white mb-2 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
      >
        {format(month, 'MMMM yyyy', { locale: de })}
      </button>

      {/* Wochentag-Header (mit KW-Spalte) */}
      <div className="flex items-center gap-1 mb-1">
        <div className="w-6 shrink-0 text-center text-[9px] font-semibold text-slate-400 dark:text-slate-500">
          KW
        </div>
        <div className="grid grid-cols-7 gap-0 flex-1">
          {WEEKDAY_LABELS.map((label, i) => (
            <div
              key={label}
              className={`text-center text-[10px] font-medium ${
                i >= 5 ? 'text-red-500 dark:text-red-400' : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {label}
            </div>
          ))}
        </div>
      </div>

      {/* Tage (mit KW-Spalte je Zeile) */}
      {weeks.map((week, wi) => (
        <div key={wi} className="flex items-center gap-1">
          <div className="w-6 shrink-0 text-center text-[9px] font-medium text-slate-400 dark:text-slate-500">
            {getISOWeek(week[0])}
          </div>
          <div className="grid grid-cols-7 gap-0 flex-1">
          {week.map((day) => {
            const inMonth = isSameMonth(day, month)
            const isToday = isSameDay(day, today)
            const dayKey = format(day, 'yyyy-MM-dd')
            const dayEvents = eventsByDay.get(dayKey) || []
            const dayOfWeek = getDay(day)
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6

            return (
              <button
                key={dayKey}
                onClick={() => onDayClick?.(day)}
                disabled={!inMonth}
                className={`relative h-7 w-full text-[11px] rounded transition-colors ${
                  !inMonth
                    ? 'text-slate-300 dark:text-slate-600'
                    : isToday
                      ? 'bg-blue-600 text-white font-bold'
                      : isWeekend
                        ? 'text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                {format(day, 'd')}
                {dayEvents.length > 0 && inMonth && (
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 flex gap-px">
                    {dayEvents.slice(0, 3).map((e, i) => (
                      <span
                        key={i}
                        className="block h-1 w-1 rounded-full"
                        style={{ backgroundColor: e.color || EVENT_TYPE_COLORS[e.type] || '#3b82f6' }}
                      />
                    ))}
                  </span>
                )}
              </button>
            )
          })}
          </div>
        </div>
      ))}
    </div>
  )
}
