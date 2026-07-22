'use client'

import { useState, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { format } from 'date-fns'
import { de } from 'date-fns/locale'
import { Video, MapPin } from 'lucide-react'
import { getGermanStateName } from '@/lib/holidays'
import type { PlantafelEvent } from './types'

/**
 * Ein einzelnes Bundesland wird ausgeschrieben, mehrere als Kürzel gelistet –
 * sonst sprengt die Liste den Tooltip.
 */
function formatStateList(codes: readonly string[]): string {
  if (codes.length === 1) return getGermanStateName(codes[0])
  return codes.join(', ')
}

const EVENT_COLORS: Record<string, string> = {
  einsatz: '#3b82f6',
  meeting: '#14b8a6',
  urlaub: '#fb923c',
  krankheit: '#ef4444',
  sonderurlaub: '#a78bfa',
  unbezahlt: '#fbbf24',
  fortbildung: '#0ea5e9',
  sonstiges: '#94a3b8',
  feiertag: '#f59e0b',
  projekt_plan: '#6366f1',
  projekt_ist: '#10b981',
}

const TYPE_LABELS: Record<string, string> = {
  einsatz: 'Einsatz',
  meeting: 'Meeting',
  urlaub: 'Urlaub',
  krankheit: 'Arbeitsunfähigkeit (AU)',
  sonderurlaub: 'Sonderurlaub',
  unbezahlt: 'Unbezahlte Freistellung',
  fortbildung: 'Fortbildung',
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
      {show && typeof document !== 'undefined' && createPortal(
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
                {' – '}
                {format(event.end, 'dd.MM.yyyy', { locale: de })}
              </div>
            )}

            {event.sourceType === 'projekt' && event.status && (
              <div className="text-slate-400">Status: {event.status}</div>
            )}

            {event.sourceType === 'projekt' && !!event.shiftCounts && (event.shiftCounts.tag > 0 || event.shiftCounts.nacht > 0) && (
              <div className="text-slate-400">
                Schichten:{' '}
                {[
                  event.shiftCounts.tag > 0 && `${event.shiftCounts.tag}× Frühschicht`,
                  event.shiftCounts.nacht > 0 && `${event.shiftCounts.nacht}× Nachtschicht`,
                ]
                  .filter(Boolean)
                  .join(', ')}
              </div>
            )}

            {event.sourceType === 'projekt' && (
              <div className="text-slate-400 text-[10px] mt-1 border-t border-slate-700 pt-1">
                Klicken für Projektdetails
              </div>
            )}

            {event.notes && !isHoliday && (
              <div className="text-slate-400 italic">{event.notes}</div>
            )}

            {isHoliday && (
              <div className="text-[10px] mt-1 border-t border-slate-700 pt-1 space-y-0.5">
                {event.holidayNationwide ? (
                  <div className="text-slate-300">Gesetzlicher Feiertag in allen Bundesländern</div>
                ) : (
                  <>
                    {!!event.holidayStates?.length && (
                      <div className="text-slate-300">
                        Gesetzlicher Feiertag in: {formatStateList(event.holidayStates)}
                      </div>
                    )}
                    {!!event.holidayPartialStates?.length && (
                      <div className="text-amber-300">
                        Teilweise in: {formatStateList(event.holidayPartialStates)}
                      </div>
                    )}
                  </>
                )}
                {event.notes && <div className="text-slate-400 italic">{event.notes}</div>}
              </div>
            )}

            {event.bestaetigt === false && event.sourceType === 'einsatz' && (
              <div className="text-orange-400 text-[10px]">Noch nicht bestätigt</div>
            )}

            {event.msJoinUrl && (
              <div className="flex items-center gap-1 text-indigo-300 text-[10px] mt-1 border-t border-slate-700 pt-1">
                <Video className="h-3 w-3 shrink-0" /> Teams-Meeting verknüpft
              </div>
            )}

            {!event.msJoinUrl && event.ort && (
              <div className="flex items-center gap-1 text-slate-300 text-[10px] mt-1 border-t border-slate-700 pt-1">
                <MapPin className="h-3 w-3 shrink-0" /> {event.ort}
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
