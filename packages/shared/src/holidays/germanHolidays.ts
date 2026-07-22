/**
 * Berechnet gesetzliche Feiertage in Deutschland für ein Jahr oder einen
 * Zeitraum – bundesweit und regional für alle 16 Bundesländer.
 *
 * Die Berechnung ist deterministisch und offline: sie braucht weder Datenbank
 * noch externen Dienst. Damit sind die Feiertage auf der Einsatztafel für jedes
 * Jahr vollständig und ohne Pflegeaufwand verfügbar.
 */

import {
  GERMAN_STATE_CODES,
  getGermanStateName,
  type GermanStateCode,
} from './germanStates'
import {
  GERMAN_HOLIDAY_DEFINITIONS,
  type GermanHolidayDefinition,
  type StateValidity,
} from './germanHolidayDefinitions'
import { addUtcDays, fromDateKey, getEasterSunday, toDateKey, utcDate } from './dateUtils'

/** Ein konkretes Feiertags-Vorkommen an einem Datum. */
export interface GermanHoliday {
  /** Eindeutig über alle Jahre: `<definitionId>-<dateKey>`. */
  id: string
  /** ID der zugrunde liegenden Regel, z. B. `fronleichnam`. */
  definitionId: string
  name: string
  /** UTC-Mitternacht des Feiertags. */
  date: Date
  /** `YYYY-MM-DD` */
  dateKey: string
  /** Gesetzlicher Feiertag in allen 16 Bundesländern. */
  nationwide: boolean
  /** Länder, in denen der Tag landesweit gesetzlicher Feiertag ist. */
  states: GermanStateCode[]
  /** Länder, in denen er nur in Teilen gilt (einzelne Gemeinden). */
  partialStates: GermanStateCode[]
  /** Erläuterung zur regionalen Einschränkung, falls vorhanden. */
  note?: string
}

export interface GermanHolidayOptions {
  /**
   * Nur Feiertage dieser Bundesländer. Leer oder weggelassen = alle 16 Länder.
   */
  states?: readonly GermanStateCode[]
  /**
   * Feiertage einbeziehen, die im Land nur regional gelten (einzelne
   * Gemeinden). Standard: `true` – für den deutschlandweiten Überblick.
   */
  includePartial?: boolean
}

function isValidInYear(validity: StateValidity, year: number): boolean {
  if (validity.from !== undefined && year < validity.from) return false
  if (validity.to !== undefined && year > validity.to) return false
  return true
}

function resolveDate(definition: GermanHolidayDefinition, year: number): Date {
  switch (definition.rule.kind) {
    case 'fixed':
      return utcDate(year, definition.rule.month, definition.rule.day)
    case 'easter':
      return addUtcDays(getEasterSunday(year), definition.rule.offset)
    case 'computed':
      return definition.rule.resolve(year)
  }
}

/**
 * Löst eine Definition für ein Jahr auf. Gibt `null` zurück, wenn der Feiertag
 * in diesem Jahr in keinem Bundesland gilt.
 */
function resolveDefinition(
  definition: GermanHolidayDefinition,
  year: number
): GermanHoliday | null {
  const states: GermanStateCode[] = []
  const partialStates: GermanStateCode[] = []
  let note: string | undefined

  for (const code of GERMAN_STATE_CODES) {
    const entry = definition.states[code]
    if (!entry) continue

    const windows = Array.isArray(entry) ? entry : [entry]
    const active = windows.find((w) => isValidInYear(w, year))
    if (!active) continue

    if (active.partial) {
      partialStates.push(code)
      if (active.note && !note) note = active.note
    } else {
      states.push(code)
    }
  }

  if (states.length === 0 && partialStates.length === 0) return null

  const date = resolveDate(definition, year)
  const dateKey = toDateKey(date)

  return {
    id: `${definition.id}-${dateKey}`,
    definitionId: definition.id,
    name: definition.name,
    date,
    dateKey,
    nationwide: states.length === GERMAN_STATE_CODES.length,
    states,
    partialStates,
    note,
  }
}

function matchesStateFilter(
  holiday: GermanHoliday,
  wanted: Set<GermanStateCode> | null,
  includePartial: boolean
): boolean {
  const relevant = includePartial
    ? [...holiday.states, ...holiday.partialStates]
    : holiday.states
  if (relevant.length === 0) return false
  if (!wanted) return true
  return relevant.some((code) => wanted.has(code))
}

/**
 * Alle gesetzlichen Feiertage eines Jahres, nach Datum sortiert.
 */
export function getGermanHolidaysForYear(
  year: number,
  options: GermanHolidayOptions = {}
): GermanHoliday[] {
  const { states, includePartial = true } = options
  const wanted = states && states.length > 0 ? new Set(states) : null

  return GERMAN_HOLIDAY_DEFINITIONS.map((definition) => resolveDefinition(definition, year))
    .filter((holiday): holiday is GermanHoliday => holiday !== null)
    .filter((holiday) => matchesStateFilter(holiday, wanted, includePartial))
    .sort((a, b) => (a.dateKey < b.dateKey ? -1 : a.dateKey > b.dateKey ? 1 : 0))
}

/**
 * Alle gesetzlichen Feiertage in einem Zeitraum (beide Grenzen inklusive).
 *
 * @param fromDate - Startdatum als `YYYY-MM-DD`
 * @param toDate - Enddatum als `YYYY-MM-DD`
 */
export function getGermanHolidaysInRange(
  fromDate: string,
  toDate: string,
  options: GermanHolidayOptions = {}
): GermanHoliday[] {
  const start = fromDateKey(fromDate)
  const end = fromDateKey(toDate)
  if (start > end) return []

  const holidays: GermanHoliday[] = []
  for (let year = start.getUTCFullYear(); year <= end.getUTCFullYear(); year++) {
    for (const holiday of getGermanHolidaysForYear(year, options)) {
      if (holiday.dateKey >= fromDate && holiday.dateKey <= toDate) {
        holidays.push(holiday)
      }
    }
  }
  return holidays
}

/**
 * Kurzbeschreibung des Geltungsbereichs für die UI, z. B.
 * "bundesweit" oder "BW, BY, HE, NW, RP, SL · teilweise SN, TH".
 */
export function formatHolidayScope(holiday: GermanHoliday): string {
  if (holiday.nationwide) return 'bundesweit'

  const parts: string[] = []
  if (holiday.states.length > 0) parts.push(holiday.states.join(', '))
  if (holiday.partialStates.length > 0) parts.push(`teilweise ${holiday.partialStates.join(', ')}`)
  return parts.join(' · ')
}

/** Ausgeschriebene Ländernamen für Tooltips. */
export function formatHolidayStateNames(holiday: GermanHoliday): string {
  if (holiday.nationwide) return 'Alle Bundesländer'
  return [...holiday.states, ...holiday.partialStates].map(getGermanStateName).join(', ')
}

/**
 * Datums-Set (`YYYY-MM-DD`) aller Feiertage im Zeitraum – für die Berechnung
 * von Feiertagszuschlägen.
 */
export function getGermanHolidayDateKeys(
  fromDate: string,
  toDate: string,
  options: GermanHolidayOptions = {}
): string[] {
  const keys = new Set(getGermanHolidaysInRange(fromDate, toDate, options).map((h) => h.dateKey))
  return Array.from(keys).sort()
}
