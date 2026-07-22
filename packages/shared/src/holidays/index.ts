/**
 * Feiertags-Modul – deterministische Berechnung deutscher Feiertage.
 * @module lib/holidays
 *
 * @example
 * ```typescript
 * import { getGermanHolidaysInRange } from '@/lib/holidays'
 *
 * // Alle Feiertage bundesweit + regional im Zeitraum
 * const alle = getGermanHolidaysInRange('2026-01-01', '2026-12-31')
 *
 * // Nur Bayern und NRW
 * const bayernNrw = getGermanHolidaysInRange('2026-01-01', '2026-12-31', {
 *   states: ['BY', 'NW'],
 * })
 * ```
 */

export {
  GERMAN_STATES,
  GERMAN_STATE_CODES,
  isGermanStateCode,
  getGermanStateName,
  getGermanStateShortName,
  normalizeStateCodes,
  type GermanState,
  type GermanStateCode,
} from './germanStates'

export {
  utcDate,
  addUtcDays,
  toDateKey,
  fromDateKey,
  getEasterSunday,
  getBussUndBettag,
} from './dateUtils'

export {
  GERMAN_HOLIDAY_DEFINITIONS,
  type GermanHolidayDefinition,
  type HolidayRule,
  type HolidayStateMap,
  type StateValidity,
} from './germanHolidayDefinitions'

export {
  ISLAMIC_HOLIDAY_COVERAGE,
  ISLAMIC_HOLIDAY_DATES,
  ISLAMIC_HOLIDAY_LENGTHS,
  ISLAMIC_HOLIDAY_NAMES,
  type IslamicHolidayEntry,
  type IslamicHolidayId,
} from './islamicHolidayDates'

export {
  getIslamicHolidaysInRange,
  isCoveredByIslamicHolidayData,
  type IslamicHoliday,
} from './islamicHolidays'

export {
  getGermanHolidaysForYear,
  getGermanHolidaysInRange,
  getGermanHolidayDateKeys,
  formatHolidayScope,
  formatHolidayStateNames,
  type GermanHoliday,
  type GermanHolidayOptions,
} from './germanHolidays'
