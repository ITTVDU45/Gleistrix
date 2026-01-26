/**
 * Time Calculation Utilities - Wiederverwendbare Berechnungsfunktionen
 * @module lib/timeEntry/calculateTimeValues
 */

/**
 * Berechnet die Stunden zwischen zwei ISO-Zeitpunkten
 * @param startISO - Startzeit als ISO-String (YYYY-MM-DDTHH:mm)
 * @param endISO - Endzeit als ISO-String
 * @returns Anzahl Stunden als Dezimalzahl
 */
export function calculateHoursForDay(startISO: string, endISO: string): number {
  const startDate = new Date(startISO)
  const endDate = new Date(endISO)
  return (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60)
}

/**
 * Berechnet die Nachtzulage (23:00-06:00) mit proportionalem Pausenabzug
 * @param startISO - Startzeit als ISO-String
 * @param endISO - Endzeit als ISO-String
 * @param pause - Pausenzeit als String (z.B. "0,5" oder "0.5")
 * @returns Nachtstunden als Dezimalzahl
 */
export function calculateNightBonus(startISO: string, endISO: string, pause: string): number {
  const startDate = new Date(startISO)
  const endDate = new Date(endISO)
  let totalNightMinutes = 0
  let totalWorkMinutes = 0
  const current = new Date(startDate)

  while (current < endDate) {
    const hour = current.getHours()
    const minute = current.getMinutes()
    const minutesOfDay = hour * 60 + minute
    totalWorkMinutes++
    // Nachtzeit: 23:00-24:00 oder 0:00-6:00
    if (minutesOfDay >= 23 * 60 || minutesOfDay < 6 * 60) {
      totalNightMinutes++
    }
    current.setMinutes(current.getMinutes() + 1)
  }

  // Pause proportional von den Nachtstunden abziehen
  const pauseNum = parseFloat((pause || '0').replace(',', '.')) || 0
  if (totalWorkMinutes > 0) {
    const nightRatio = totalNightMinutes / totalWorkMinutes
    const pauseInNight = pauseNum * 60 * nightRatio
    totalNightMinutes = Math.max(0, totalNightMinutes - pauseInNight)
  }

  return totalNightMinutes / 60
}

/**
 * Berechnet die Sonntagsstunden für einen Zeitraum
 * @param startISO - Startzeit als ISO-String
 * @param endISO - Endzeit als ISO-String
 * @returns Sonntagsstunden als Dezimalzahl
 */
export function calculateSundayHours(startISO: string, endISO: string): number {
  const startDate = new Date(startISO)
  const endDate = new Date(endISO)
  let totalSundayMinutes = 0
  const current = new Date(startDate)

  while (current < endDate) {
    if (current.getDay() === 0) {
      // 0 = Sonntag
      totalSundayMinutes++
    }
    current.setMinutes(current.getMinutes() + 1)
  }

  return totalSundayMinutes / 60
}

/**
 * Berechnet Feiertagsstunden für tagübergreifende Einträge
 * @param startISO - Startzeit als ISO-String
 * @param endISO - Endzeit als ISO-String
 * @param isStartDayHoliday - Ob der Starttag ein Feiertag ist
 * @param isEndDayHoliday - Ob der Endtag ein Feiertag ist
 * @returns Feiertagsstunden (gerundet)
 */
export function calculateHolidayHours(
  startISO: string,
  endISO: string,
  isStartDayHoliday: boolean,
  isEndDayHoliday: boolean
): number {
  let feiertagsStunden = 0

  if (isStartDayHoliday) {
    const startDate = new Date(startISO)
    const day = startISO.slice(0, 10)
    const endOfDay = new Date(day + 'T23:59:59')
    feiertagsStunden += Math.round((endOfDay.getTime() - startDate.getTime()) / (1000 * 60 * 60))
  }

  if (isEndDayHoliday) {
    const endDay = endISO.slice(0, 10)
    const startOfDay = new Date(endDay + 'T00:00:00')
    const endDate = new Date(endISO)
    feiertagsStunden += Math.round((endDate.getTime() - startOfDay.getTime()) / (1000 * 60 * 60))
  }

  return feiertagsStunden
}

/**
 * Parst einen Zahlenwert aus einem String (mit Komma oder Punkt als Dezimaltrennzeichen)
 * @param value - Der zu parsende String
 * @param defaultValue - Standardwert bei Fehler
 * @returns Geparste Zahl
 */
export function parseNumber(value: string, defaultValue = 0): number {
  if (!value || value.trim() === '') return defaultValue
  const parsed = parseFloat(value.replace(',', '.'))
  return isNaN(parsed) ? defaultValue : parsed
}
