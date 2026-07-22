/**
 * Datums-Hilfsfunktionen für die Feiertagsberechnung.
 *
 * Alle Feiertagsdaten werden konsequent in UTC gerechnet und als
 * `YYYY-MM-DD`-Schlüssel geführt. Das verhindert die Zeitzonen-Verschiebung um
 * einen Tag, die entsteht, wenn lokale `Date`-Objekte über `toISOString()`
 * formatiert werden.
 */

/** Erzeugt ein UTC-Datum um Mitternacht. `month` ist 1-basiert. */
export function utcDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day))
}

/** Verschiebt ein UTC-Datum um `days` Tage (negativ = rückwärts). */
export function addUtcDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000)
}

/** Formatiert ein UTC-Datum als `YYYY-MM-DD`. */
export function toDateKey(date: Date): string {
  const y = String(date.getUTCFullYear()).padStart(4, '0')
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Parst `YYYY-MM-DD` zu einem UTC-Datum. Wirft bei ungültigem Format. */
export function fromDateKey(dateKey: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey)
  if (!match) {
    throw new Error(`Ungültiges Datumsformat: "${dateKey}". Erwartet YYYY-MM-DD.`)
  }
  return utcDate(Number(match[1]), Number(match[2]), Number(match[3]))
}

/**
 * Berechnet den Ostersonntag nach dem anonymen gregorianischen Algorithmus
 * (Meeus/Jones/Butcher). Gültig für alle Jahre des gregorianischen Kalenders.
 */
export function getEasterSunday(year: number): Date {
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
  return utcDate(year, month, day)
}

/**
 * Buß- und Bettag: der Mittwoch vor dem 23. November.
 * Fällt der 23. selbst auf einen Mittwoch, gilt der Mittwoch davor.
 */
export function getBussUndBettag(year: number): Date {
  let date = utcDate(year, 11, 22)
  while (date.getUTCDay() !== 3) {
    date = addUtcDays(date, -1)
  }
  return date
}
