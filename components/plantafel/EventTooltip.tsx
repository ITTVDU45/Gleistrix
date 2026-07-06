'use client'

import { useState, useCallback, useRef } from 'react'
import { format } from 'date-fns'
import { de } from 'date-fns/locale'
import type { PlantafelEvent } from './types'

const EVENT_COLORS: Record<string, string> = {
  einsatz: '#3b82f6',
  meeting: '#14b8a6',
  urlaub: '#fb923c',
  krankheit: '#ef4444',
  sonderurlaub: '#a78bfa',
  unbezahlt: '#fbbf24',
  sonstiges: '#94a3b8',
  feiertag: '#f59e0b',
  projekt_plan: '#6366f1',
  projekt_ist: '#10b981',
}

const TYPE_LABELS: Record<string, string> = {
  einsatz: 'Einsatz',
  meeting: 'Meeting',
  urlaub: 'Urlaub',
  krankheit: 'Krankheit',
  sonderurlaub: 'Sonderurlaub',
  unbezahlt: 'Unbezahlt',
  feiertag: 'Feiertag',
  sonstiges: 'Sonstiges',
  projekt_plan: 'Projekt (geplant)',
  projekt_ist: 'Projekt (umgesetzt)',
}

interface EventTooltipProps {
  event: PlantafelEvent
  children: React.ReactNode
}

export default function EventTooltip({ event, children }: EventTooltipProps) {
  const [show, setShow] = useState(false)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleMouseEnter = useCallback((e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setPos({ x: rect.left + rect.width / 2, y: rect.top })
    timeoutRef.current = setTimeout(() => setShow(true), 300)
  }, [])

  const handleMouseLeave = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setShow(false)
  }, [])

  const isHoliday = event.sourceType === 'feiertag'
  const isAbsence = event.sourceType === 'urlaub'
  const color = event.color || EVENT_COLORS[event.type] || '#3b82f6'

  return (
    <div
      className="relative h-full"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      {show && (
        <div
          className="fixed z-[9999] pointer-events-none"
          style={{ left: pos.x, top: pos.y - 8, transform: 'translate(-50%, -100%)' }}
        >
          <div className="bg-slate-900 text-white text-xs rounded-lg shadow-lg px-3 py-2 max-w-64 space-y-1">
            <div className="flex items-center gap-1.5">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                style={{ backgroundColor: color }}
              />
              <span className="font-semibold truncate">{event.title}</span>
            </div>

            <div className="text-slate-300">
              {event.sourceType === 'projekt'
                ? event.notStarted
                  ? 'Projekt · nicht gestartet'
                  : 'Projekt'
                : TYPE_LABELS[event.type] || event.type}
              {event.mitarbeiterName && !isAbsence && (
                <> &middot; {event.mitarbeiterName}</>
              )}
            </div>

            {!event.allDay && (
              <div className="text-slate-400">
                {format(event.start, 'dd.MM.yy HH:mm', { locale: de })}
                {' – '}
                {format(event.end, 'dd.MM.yy HH:mm', { locale: de })}
              </div>
            )}

            {event.allDay && (
              <div className="text-slate-400">
                {format(event.start, 'dd.MM.yyyy', { locale: de })}
              </div>
            )}

            {event.sourceType === 'projekt' && event.status && (
              <div className="text-slate-400">Status: {event.status}</div>
            )}

            {event.sourceType === 'projekt' && (event.shiftSummary?.tag || event.shiftSummary?.nacht) && (
              <div className="text-slate-400">
                Schichten:{' '}
                {[event.shiftSummary?.tag && 'Frühschicht', event.shiftSummary?.nacht && 'Nachtschicht']
                  .filter(Boolean)
                  .join(', ')}
              </div>
            )}

            {event.sourceType === 'projekt' && (
              <div className="text-slate-400 text-[10px] mt-1 border-t border-slate-700 pt-1">
                Klicken für Projektdetails
              </div>
            )}

            {event.notes && (
              <div className="text-slate-400 italic">{event.notes}</div>
            )}

            {isHoliday && (
              <div className="text-amber-400 text-[10px] mt-1 border-t border-slate-700 pt-1">
                ⚠ Feiertage können um einen Tag abweichen
              </div>
            )}

            {event.bestaetigt === false && event.sourceType === 'einsatz' && (
              <div className="text-orange-400 text-[10px]">Noch nicht bestätigt</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
