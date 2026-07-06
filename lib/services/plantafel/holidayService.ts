import { eachDayOfInterval, format } from 'date-fns'
import type { PlantafelEvent, PlantafelDateRange } from '@/components/plantafel/types'

export interface PlantafelHoliday {
  id: string
  name: string
  title: string
  date: Date
  dateKey: string
  type: 'german' | 'islamic'
  scope: string
  states?: string[]
}

const EVENT_COLORS = {
  feiertagDeutsch: '#b45309',
  feiertagIslamisch: '#0f766e',
}

export function toDateKey(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

let islamicFormatter: Intl.DateTimeFormat | null = null
try {
  islamicFormatter = new Intl.DateTimeFormat('en-US-u-ca-islamic-civil', {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  })
} catch { /* unsupported */ }

const ISLAMIC_HOLIDAYS = [
  { id: 'ramadanbeginn', name: 'Ramadanbeginn', month: 9, day: 1 },
  { id: 'ramadanfest', name: 'Ramadanfest', month: 10, day: 1 },
  { id: 'opferfest', name: 'Opferfest', month: 12, day: 10 },
]

export function getIslamicHolidaysInRange(range: PlantafelDateRange): PlantafelHoliday[] {
  if (!islamicFormatter) return []
  const byDate = new Map(ISLAMIC_HOLIDAYS.map((h) => [`${h.month}-${h.day}`, h]))
  const holidays: PlantafelHoliday[] = []

  for (const date of eachDayOfInterval({ start: range.start, end: range.end })) {
    const utc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 12))
    const parts = islamicFormatter.formatToParts(utc)
    const m = Number(parts.find((p) => p.type === 'month')?.value || 0)
    const d = Number(parts.find((p) => p.type === 'day')?.value || 0)
    const y = Number(parts.find((p) => p.type === 'year')?.value || 0)
    const def = byDate.get(`${m}-${d}`)
    if (!def) continue
    const dateKey = toDateKey(date)
    holidays.push({
      id: `islamic-${y}-${def.id}-${dateKey}`,
      name: def.name,
      title: def.name,
      date,
      dateKey,
      type: 'islamic',
      scope: 'islamischer Kalender',
    })
  }
  return holidays
}

export function holidaysToPlantafelEvents(holidays: PlantafelHoliday[]): PlantafelEvent[] {
  return holidays.map((h) => {
    const [y, m, d] = h.dateKey.split('-').map(Number)
    return {
      id: `feiertag-${h.id}`,
      title: h.title,
      start: new Date(y, m - 1, d, 0, 0, 0, 0),
      end: new Date(y, m - 1, d, 23, 59, 59, 999),
      resourceId: 'feiertage',
      allDay: true,
      type: 'feiertag',
      sourceType: 'feiertag',
      sourceId: h.id,
      holidayType: h.type,
      holidayScope: h.scope,
      color: h.type === 'islamic' ? EVENT_COLORS.feiertagIslamisch : EVENT_COLORS.feiertagDeutsch,
      notes: [h.scope, h.states?.join(', ')].filter(Boolean).join(' · '),
      hasConflict: false,
    }
  })
}
