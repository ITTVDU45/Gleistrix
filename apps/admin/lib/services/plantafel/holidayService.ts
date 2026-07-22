import { eachDayOfInterval, format } from 'date-fns'
import type { PlantafelEvent, PlantafelDateRange } from '@/components/plantafel/types'
import {
  formatHolidayScope,
  getGermanHolidaysInRange,
  type GermanHoliday,
  type GermanStateCode,
} from '@/lib/holidays'

export interface PlantafelHoliday {
  id: string
  name: string
  title: string
  date: Date
  dateKey: string
  type: 'german' | 'islamic' | 'custom'
  scope: string
  /** Länderkürzel, in denen der Feiertag landesweit gilt. */
  states?: string[]
  /** Länderkürzel, in denen er nur regional (einzelne Gemeinden) gilt. */
  partialStates?: string[]
  /** Gilt in allen 16 Bundesländern. */
  nationwide?: boolean
  /** Erläuterung zur regionalen Einschränkung. */
  note?: string
}

const EVENT_COLORS = {
  feiertagDeutsch: '#b45309',
  feiertagRegional: '#c2410c',
  feiertagIslamisch: '#0f766e',
  feiertagCustom: '#7c3aed',
}

export function toDateKey(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

// ---------------------------------------------------------------------------
// Deutsche Feiertage (berechnet, bundesweit + regional)
// ---------------------------------------------------------------------------

/**
 * Deutsche Feiertage für den Zeitraum – deterministisch berechnet statt aus der
 * Datenbank gelesen. Dadurch sind auch die regionalen Feiertage aller 16
 * Bundesländer lückenlos verfügbar.
 *
 * @param states - Nur diese Bundesländer; leer = alle 16
 * @param includePartial - Auch Tage, die nur in Teilen eines Landes gelten
 */
export function getGermanHolidaysForPlantafel(
  fromDate: string,
  toDate: string,
  states: readonly GermanStateCode[] = [],
  includePartial = true
): PlantafelHoliday[] {
  return getGermanHolidaysInRange(fromDate, toDate, { states, includePartial })
    .map(toPlantafelHoliday)
}

function toPlantafelHoliday(holiday: GermanHoliday): PlantafelHoliday {
  const scope = formatHolidayScope(holiday)
  const [y, m, d] = holiday.dateKey.split('-').map(Number)

  return {
    id: `de-${holiday.id}`,
    name: holiday.name,
    // Regionale Feiertage im Titel kennzeichnen, damit sie in der Wochen- und
    // Monatsansicht ohne Tooltip unterscheidbar bleiben.
    title: holiday.nationwide ? holiday.name : `${holiday.name} (${scope})`,
    date: new Date(y, m - 1, d),
    dateKey: holiday.dateKey,
    type: 'german',
    scope,
    states: holiday.states,
    partialStates: holiday.partialStates,
    nationwide: holiday.nationwide,
    note: holiday.note,
  }
}

// ---------------------------------------------------------------------------
// Zusätzliche, manuell gepflegte Feiertage aus der Datenbank
// ---------------------------------------------------------------------------

export interface CustomHolidayRecord {
  _id: unknown
  date: string
  name: string
  bundesland: string
}

/**
 * Wandelt manuell gepflegte `Holiday`-Einträge in Plantafel-Feiertage um.
 *
 * Einträge, die einen bereits berechneten gesetzlichen Feiertag am selben Tag
 * und im selben Geltungsbereich abbilden, werden verworfen – sonst erschiene
 * z. B. Neujahr doppelt. Übrig bleiben echte Zusatztage (Betriebsruhe o. Ä.).
 */
export function getCustomHolidaysForPlantafel(
  records: readonly CustomHolidayRecord[],
  computed: readonly PlantafelHoliday[],
  states: readonly GermanStateCode[] = []
): PlantafelHoliday[] {
  const computedByDate = new Map<string, PlantafelHoliday[]>()
  for (const holiday of computed) {
    const list = computedByDate.get(holiday.dateKey)
    if (list) list.push(holiday)
    else computedByDate.set(holiday.dateKey, [holiday])
  }

  const wantedStates = states.length > 0 ? new Set<string>(states) : null

  return records
    .filter((record) => !isCoveredByStatutoryHoliday(record, computedByDate))
    .filter((record) => {
      if (!wantedStates || record.bundesland === 'ALL') return true
      return wantedStates.has(record.bundesland)
    })
    .map((record) => {
      const dateKey = String(record.date)
      const [y, m, d] = dateKey.split('-').map(Number)
      const isNationwide = record.bundesland === 'ALL'
      const scope = isNationwide ? 'betrieblich, bundesweit' : `betrieblich, ${record.bundesland}`

      return {
        id: `custom-${String(record._id)}`,
        name: record.name,
        title: `${record.name} (betrieblich)`,
        date: new Date(y, m - 1, d),
        dateKey,
        type: 'custom' as const,
        scope,
        states: isNationwide ? [] : [record.bundesland],
        partialStates: [],
        nationwide: isNationwide,
      }
    })
}

function isCoveredByStatutoryHoliday(
  record: CustomHolidayRecord,
  computedByDate: ReadonlyMap<string, PlantafelHoliday[]>
): boolean {
  const sameDay = computedByDate.get(String(record.date))
  if (!sameDay || sameDay.length === 0) return false
  if (record.bundesland === 'ALL') return sameDay.some((h) => h.nationwide)
  return sameDay.some(
    (h) =>
      h.nationwide ||
      h.states?.includes(record.bundesland) ||
      h.partialStates?.includes(record.bundesland)
  )
}

// ---------------------------------------------------------------------------
// Islamische Feiertage
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Mapping auf Kalender-Events
// ---------------------------------------------------------------------------

function holidayColor(holiday: PlantafelHoliday): string {
  if (holiday.type === 'islamic') return EVENT_COLORS.feiertagIslamisch
  if (holiday.type === 'custom') return EVENT_COLORS.feiertagCustom
  return holiday.nationwide ? EVENT_COLORS.feiertagDeutsch : EVENT_COLORS.feiertagRegional
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
      holidayStates: h.states,
      holidayPartialStates: h.partialStates,
      holidayNationwide: h.nationwide,
      color: holidayColor(h),
      notes: [h.scope, h.note].filter(Boolean).join(' · '),
      hasConflict: false,
    }
  })
}
