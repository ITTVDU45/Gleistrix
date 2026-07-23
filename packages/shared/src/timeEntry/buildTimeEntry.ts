/**
 * TimeEntry Builder - Erstellt TimeEntry-Objekte aus Formular-Daten
 * @module lib/timeEntry/buildTimeEntry
 */

import { format, addDays, parseISO } from 'date-fns'
import type { TimeEntryWithSunday, BuildEntryParams } from './types'
import {
  calculateHoursForDay,
  calculateNightBonus,
  calculateSundayHours,
  calculateHolidayHours,
  parseNumber
} from './calculateTimeValues'

/**
 * Erstellt einen einzelnen TimeEntry für einen Tag
 * @param params - Parameter für die Entry-Erstellung
 * @returns TimeEntry-Objekt
 */
export function buildTimeEntry(params: BuildEntryParams): TimeEntryWithSunday {
  const {
    name,
    employeeId,
    funktion,
    day,
    startTime,
    endTime,
    pause,
    extra,
    fahrtstunden,
    bemerkung,
    isMultiDay,
    isHoliday,
    isSunday,
    initialEntryId,
    manualHours
  } = params

  let startISO: string
  let endISO: string

  if (isMultiDay) {
    // Tagübergreifend: Endzeit am Folgetag
    const nextDay = addDays(parseISO(day), 1)
    const nextDayStr = format(nextDay, 'yyyy-MM-dd')
    startISO = `${day}T${startTime}`
    endISO = `${nextDayStr}T${endTime}`
  } else {
    // Gleicher Tag
    startISO = `${day}T${startTime}`
    endISO = `${day}T${endTime}`
  }

  const sonntagsstunden = calculateSundayHours(startISO, endISO)
  const pauseNum = parseNumber(pause)
  // Manuelle Arbeitsstunden überschreiben nur die Gesamtstunden.
  // Nacht-, Sonntags- und Feiertagsstunden bleiben aus Start/Ende berechnet.
  const isManualHours = typeof manualHours === 'number' && Number.isFinite(manualHours)
  const berechneteStunden = calculateHoursForDay(startISO, endISO) - pauseNum
  const gesamtStunden = isManualHours ? Math.max(0, manualHours as number) : berechneteStunden

  // Feiertagsstunden berechnen
  let feiertagsStunden = 0
  if (isHoliday) {
    if (isMultiDay) {
      // Bei tagübergreifend: separate Berechnung für Start- und Endtag
      feiertagsStunden = calculateHolidayHours(startISO, endISO, isHoliday, false)
    } else {
      // Immer aus den berechneten Stunden: Zuschläge bleiben unabhängig
      // von einer manuellen Korrektur der Arbeitsstunden.
      feiertagsStunden = Math.round(berechneteStunden)
    }
  }

  const entry: TimeEntryWithSunday = {
    id: initialEntryId || `${Date.now().toString()}-${name}-${day}`,
    employeeId,
    name,
    funktion,
    start: startISO,
    ende: endISO,
    stunden: gesamtStunden,
    stundenManuell: isManualHours,
    pause,
    extra: parseNumber(extra),
    fahrtstunden: parseNumber(fahrtstunden),
    feiertag: feiertagsStunden,
    sonntag: isSunday ? 1 : 0,
    sonntagsstunden,
    bemerkung,
    nachtzulage: calculateNightBonus(startISO, endISO, pause).toString()
  }

  return entry
}

/**
 * Erstellt TimeEntries für mehrere Tage für einen Mitarbeiter
 * @param employeeName - Name des Mitarbeiters
 * @param days - Array von Tagen (YYYY-MM-DD)
 * @param baseParams - Basis-Parameter (ohne name und day)
 * @param holidayDays - Array von Tagen, die Feiertage sind (dd.MM.yyyy Format)
 * @returns Array von TimeEntry-Objekten
 */
export function buildTimeEntriesForDays(
  employeeName: string,
  days: string[],
  baseParams: Omit<BuildEntryParams, 'name' | 'day' | 'isHoliday'>,
  holidayDays: string[] = []
): TimeEntryWithSunday[] {
  return days.map(day => {
    // Prüfe, ob dieser Tag ein Feiertag ist (Format: dd.MM.yyyy)
    const dayFormatted = format(parseISO(day), 'dd.MM.yyyy')
    const isHoliday = holidayDays.includes(dayFormatted)

    return buildTimeEntry({
      ...baseParams,
      name: employeeName,
      day,
      isHoliday
    })
  })
}

/**
 * Erstellt ein Array von Batch-Payloads für die API
 * Jedes Payload enthält alle Tage für einen Mitarbeiter
 * @param employees - Array von Mitarbeiternamen
 * @param days - Array von Tagen
 * @param baseParams - Basis-Parameter
 * @param holidayDays - Feiertage
 * @returns Array von { employeeName, days, entry } Objekten
 */
export function prepareBatchPayloads(
  employees: string[],
  days: string[],
  baseParams: Omit<BuildEntryParams, 'name' | 'day' | 'isHoliday'>,
  holidayDays: string[] = []
): Array<{ employeeName: string; days: string[]; entries: TimeEntryWithSunday[] }> {
  return employees.map(employeeName => ({
    employeeName,
    days,
    entries: buildTimeEntriesForDays(employeeName, days, baseParams, holidayDays)
  }))
}
