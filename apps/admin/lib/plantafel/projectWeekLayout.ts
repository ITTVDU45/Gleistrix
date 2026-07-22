/**
 * Layout-Berechnung für die Projekt-Wochenansicht der Einsatztafel:
 * Projekte werden als Balken über die Tagesspalten (Mo–So) gespannt,
 * auf die sichtbare Woche zugeschnitten.
 */

import { addDays, differenceInCalendarDays, format, startOfDay, startOfWeek } from 'date-fns'

const DAYS_PER_WEEK = 7
const LAST_DAY_INDEX = DAYS_PER_WEEK - 1

export interface ProjectBarSpan {
  /** Erste belegte Tagesspalte (0 = Montag). */
  startIndex: number
  /** Letzte belegte Tagesspalte, inklusiv (6 = Sonntag). */
  endIndex: number
  /** Projekt beginnt vor der sichtbaren Woche. */
  continuesBefore: boolean
  /** Projekt endet nach der sichtbaren Woche. */
  continuesAfter: boolean
}

interface DateRangeLike {
  start: Date | string
  end: Date | string
}

/** Montag der Woche, in der das Datum liegt. */
export function getWeekStart(date: Date): Date {
  return startOfWeek(date, { weekStartsOn: 1 })
}

/** Die 7 Tage (Mo–So) der Woche, in der das Datum liegt. */
export function getWeekDays(date: Date): Date[] {
  const weekStart = getWeekStart(date)
  return Array.from({ length: DAYS_PER_WEEK }, (_, i) => addDays(weekStart, i))
}

/** Tagesschlüssel für Map-Zugriffe (lokale Zeitzone). */
export function toDayKey(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

/**
 * Spaltenbereich eines Projekt-Laufzeitbalkens innerhalb der Woche.
 * Start- und Enddatum gelten als inklusive Kalendertage; liegt die Laufzeit
 * komplett außerhalb der Woche, gibt es keinen Balken (null).
 */
export function getProjectBarSpan(range: DateRangeLike, weekStart: Date): ProjectBarSpan | null {
  const startDay = startOfDay(new Date(range.start))
  const endDay = startOfDay(new Date(range.end))
  const startIndex = differenceInCalendarDays(startDay, weekStart)
  const endIndex = differenceInCalendarDays(endDay, weekStart)

  if (endIndex < 0 || startIndex > LAST_DAY_INDEX) return null

  const clampedStart = Math.max(0, startIndex)
  return {
    startIndex: clampedStart,
    // Schutz vor invertierten Laufzeiten (Ende vor Beginn): mindestens 1 Tag.
    endIndex: Math.max(clampedStart, Math.min(LAST_DAY_INDEX, endIndex)),
    continuesBefore: startIndex < 0,
    continuesAfter: endIndex > LAST_DAY_INDEX,
  }
}

interface HolidayEventLike {
  sourceType: string
  title: string
  start: Date | string
}

/**
 * Feiertagstitel je Wochentag (Schlüssel: yyyy-MM-dd). Nur Tage der
 * übergebenen Woche werden aufgenommen; andere Event-Typen werden ignoriert.
 */
export function getHolidayTitlesByDay(
  events: readonly HolidayEventLike[],
  weekDays: readonly Date[]
): Map<string, string[]> {
  const weekKeys = new Set(weekDays.map(toDayKey))
  const byDay = new Map<string, string[]>()
  for (const event of events) {
    if (event.sourceType !== 'feiertag') continue
    const dayKey = toDayKey(startOfDay(new Date(event.start)))
    if (!weekKeys.has(dayKey)) continue
    byDay.set(dayKey, [...(byDay.get(dayKey) ?? []), event.title])
  }
  return byDay
}

interface SortableProjectLike {
  start: Date | string
  title: string
}

/** Projekte nach Laufzeitbeginn, bei Gleichstand alphabetisch nach Titel. */
export function sortProjectEvents<T extends SortableProjectLike>(events: readonly T[]): T[] {
  return [...events].sort((a, b) => {
    const startDiff = new Date(a.start).getTime() - new Date(b.start).getTime()
    if (startDiff !== 0) return startDiff
    return a.title.localeCompare(b.title, 'de')
  })
}
