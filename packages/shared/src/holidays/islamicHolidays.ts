/**
 * Islamische Feiertage für die Einsatztafel — nach DITIB-/Diyanet-Kalender.
 *
 * Die Daten stammen aus einer gepflegten Liste (siehe `islamicHolidayDates`),
 * nicht aus einer Näherungsrechnung. Außerhalb des gepflegten Zeitraums liefert
 * die Funktion bewusst nichts: ein fehlender Feiertag ist besser als ein
 * falscher. `isCoveredByIslamicHolidayData` macht diesen Rand prüfbar.
 */

import { fromDateKey } from './dateUtils'
import {
  ISLAMIC_HOLIDAY_COVERAGE,
  ISLAMIC_HOLIDAY_DATES,
  ISLAMIC_HOLIDAY_LENGTHS,
  ISLAMIC_HOLIDAY_NAMES,
  type IslamicHolidayId,
} from './islamicHolidayDates'

/** Ein konkretes Vorkommen eines islamischen Feiertags. */
export interface IslamicHoliday {
  /** Eindeutig über alle Jahre: `<definitionId>-<dateKey>`. */
  id: string
  definitionId: IslamicHolidayId
  /** Anzeigename inkl. Tageszählung bei mehrtägigen Festen. */
  name: string
  /** UTC-Mitternacht des Feiertags. */
  date: Date
  /** `YYYY-MM-DD` */
  dateKey: string
  /** Tag innerhalb des Festes (1-basiert). */
  day: number
  /** Gesamtzahl der Tage des Festes. */
  totalDays: number
}

function displayName(id: IslamicHolidayId, day: number): string {
  const base = ISLAMIC_HOLIDAY_NAMES[id]
  return ISLAMIC_HOLIDAY_LENGTHS[id] > 1 ? `${base} (${day}. Tag)` : base
}

/**
 * Islamische Feiertage im Zeitraum, aufsteigend nach Datum.
 *
 * @param from - `YYYY-MM-DD`, inklusive
 * @param to - `YYYY-MM-DD`, inklusive
 */
export function getIslamicHolidaysInRange(from: string, to: string): IslamicHoliday[] {
  return ISLAMIC_HOLIDAY_DATES.filter(
    (entry) => entry.dateKey >= from && entry.dateKey <= to
  ).map((entry) => ({
    id: `${entry.id}-${entry.dateKey}`,
    definitionId: entry.id,
    name: displayName(entry.id, entry.day),
    date: fromDateKey(entry.dateKey),
    dateKey: entry.dateKey,
    day: entry.day,
    totalDays: ISLAMIC_HOLIDAY_LENGTHS[entry.id],
  }))
}

/**
 * Ist der Zeitraum vollständig von den gepflegten Daten abgedeckt?
 * Falsch bedeutet: für einen Teil des Zeitraums fehlen Feiertage, weil die
 * Liste dort endet — nicht, dass es dort keine gibt.
 */
export function isCoveredByIslamicHolidayData(from: string, to: string): boolean {
  return (
    from >= ISLAMIC_HOLIDAY_COVERAGE.fromDateKey && to <= ISLAMIC_HOLIDAY_COVERAGE.toDateKey
  )
}
