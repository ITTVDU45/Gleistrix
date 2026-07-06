import { addDays, eachDayOfInterval, format } from 'date-fns'
import type { PlantafelEvent, PlantafelHolidayType, PlantafelDateRange } from '@/components/plantafel/types'

export interface PlantafelHoliday {
  id: string
  name: string
  title: string
  date: Date
  dateKey: string
  type: PlantafelHolidayType
  scope: string
  states?: string[]
}

interface GermanHolidayDef {
  id: string
  name: string
  month?: number
  day?: number
  easterOffset?: number
  scope: string
  states?: string[]
}

const GERMAN_FIXED: GermanHolidayDef[] = [
  { id: 'neujahr', name: 'Neujahr', month: 1, day: 1, scope: 'bundesweit' },
  { id: 'heilige-drei-koenige', name: 'Heilige Drei Könige', month: 1, day: 6, scope: 'regional', states: ['BW', 'BY', 'ST'] },
  { id: 'tag-der-arbeit', name: 'Tag der Arbeit', month: 5, day: 1, scope: 'bundesweit' },
  { id: 'tag-der-deutschen-einheit', name: 'Tag der Deutschen Einheit', month: 10, day: 3, scope: 'bundesweit' },
  { id: 'reformationstag', name: 'Reformationstag', month: 10, day: 31, scope: 'regional', states: ['BB', 'HB', 'HH', 'MV', 'NI', 'SN', 'ST', 'SH', 'TH'] },
  { id: 'allerheiligen', name: 'Allerheiligen', month: 11, day: 1, scope: 'regional', states: ['BW', 'BY', 'NW', 'RP', 'SL'] },
  { id: 'erster-weihnachtstag', name: '1. Weihnachtstag', month: 12, day: 25, scope: 'bundesweit' },
  { id: 'zweiter-weihnachtstag', name: '2. Weihnachtstag', month: 12, day: 26, scope: 'bundesweit' },
]

const GERMAN_EASTER: GermanHolidayDef[] = [
  { id: 'karfreitag', name: 'Karfreitag', easterOffset: -2, scope: 'bundesweit' },
  { id: 'ostermontag', name: 'Ostermontag', easterOffset: 1, scope: 'bundesweit' },
  { id: 'christi-himmelfahrt', name: 'Christi Himmelfahrt', easterOffset: 39, scope: 'bundesweit' },
  { id: 'pfingstmontag', name: 'Pfingstmontag', easterOffset: 50, scope: 'bundesweit' },
  { id: 'fronleichnam', name: 'Fronleichnam', easterOffset: 60, scope: 'regional', states: ['BW', 'BY', 'HE', 'NW', 'RP', 'SL'] },
]

const EVENT_COLORS = {
  feiertagDeutsch: '#b45309',
  feiertagIslamisch: '#0f766e',
}

function getEasterSunday(year: number): Date {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month - 1, day)
}

function toDateKey(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

function getGermanHolidaysForYear(year: number): PlantafelHoliday[] {
  const easter = getEasterSunday(year)

  const fixed = GERMAN_FIXED.map((h) => {
    const date = new Date(year, (h.month || 1) - 1, h.day || 1)
    const dateKey = toDateKey(date)
    return {
      id: `de-${year}-${h.id}-${dateKey}`,
      name: h.name,
      title: h.scope !== 'bundesweit' ? `${h.name} (regional)` : h.name,
      date,
      dateKey,
      type: 'german' as PlantafelHolidayType,
      scope: h.scope,
      states: h.states,
    }
  })

  const easterBased = GERMAN_EASTER.map((h) => {
    const date = addDays(easter, h.easterOffset || 0)
    const dateKey = toDateKey(date)
    return {
      id: `de-${year}-${h.id}-${dateKey}`,
      name: h.name,
      title: h.scope !== 'bundesweit' ? `${h.name} (regional)` : h.name,
      date,
      dateKey,
      type: 'german' as PlantafelHolidayType,
      scope: h.scope,
      states: h.states,
    }
  })

  return [...fixed, ...easterBased]
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

function getIslamicHolidaysInRange(range: PlantafelDateRange): PlantafelHoliday[] {
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

export function getPlantafelHolidays(
  range: PlantafelDateRange,
  options: { showGermanHolidays: boolean; showIslamicHolidays: boolean }
): PlantafelHoliday[] {
  const holidays: PlantafelHoliday[] = []
  const fromYear = range.start.getFullYear()
  const toYear = range.end.getFullYear()

  if (options.showGermanHolidays) {
    for (let year = fromYear; year <= toYear; year += 1) {
      holidays.push(...getGermanHolidaysForYear(year))
    }
  }
  if (options.showIslamicHolidays) {
    holidays.push(...getIslamicHolidaysInRange(range))
  }

  const fromKey = toDateKey(range.start)
  const toKey = toDateKey(range.end)
  return holidays
    .filter((h) => h.dateKey >= fromKey && h.dateKey <= toKey)
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey))
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
