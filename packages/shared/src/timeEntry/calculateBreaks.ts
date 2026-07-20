/**
 * Pausenberechnung - Automatische Berechnung von Pausen nach Regelwerk
 * @module lib/timeEntry/calculateBreaks
 * 
 * Regelwerk:
 * - bis 5 Stunden: keine Pause
 * - > 5 bis 9 Stunden: 30 Minuten Pause
 * - > 9 bis 10 Stunden: 45 Minuten Pause (30 + 15)
 * - > 10 Stunden: 60 Minuten Pause (30 + 15 + 15)
 * 
 * Pausenpositionen:
 * - Pause 1 (30 Min): nach 5 Stunden Arbeitszeit
 * - Pause 2 (15 Min): nach 9 Stunden Arbeitszeit (unter Berücksichtigung von Pause 1)
 * - Pause 3 (15 Min): nach 9,5 Stunden Arbeitszeit (unter Berücksichtigung von Pause 1+2)
 */

import { addMinutes, format } from 'date-fns'
import type { BreakSegment } from './types'

/**
 * Berechnet die erforderliche Pausendauer basierend auf der Arbeitszeit
 * @param workMinutes - Arbeitszeit in Minuten (ohne Pausen)
 * @returns Erforderliche Pausendauer in Minuten
 */
export function calculateRequiredBreakMinutes(workMinutes: number): number {
  if (workMinutes <= 300) return 0          // bis 5h (300 min)
  if (workMinutes <= 540) return 30         // >5h bis 9h (540 min)
  if (workMinutes <= 600) return 45         // >9h bis 10h (600 min)
  return 60                                  // >10h
}

/**
 * Berechnet die Pausensegmente basierend auf Start/Ende und erforderlicher Pausendauer
 * 
 * Regeln:
 * - Pause 1 (30 Min) wird nach 5 Arbeitsstunden eingefügt
 * - Pause 2 (15 Min) wird nach 9 Arbeitsstunden eingefügt (falls erforderlich)
 * - Pause 3 (15 Min) wird nach 9,5 Arbeitsstunden eingefügt (falls >10h Schicht)
 * 
 * @param startISO - Startzeit als ISO-String
 * @param endISO - Endzeit als ISO-String
 * @param requiredMinutes - Erforderliche Pausendauer in Minuten
 * @returns Array von Pausensegmenten
 */
export function calculateBreakSegments(
  startISO: string,
  endISO: string,
  requiredMinutes: number
): BreakSegment[] {
  if (requiredMinutes === 0) return []

  const startDate = new Date(startISO)
  const segments: BreakSegment[] = []

  // Pause 1: nach 5 Stunden (300 Minuten) Arbeitszeit
  if (requiredMinutes >= 30) {
    const pause1Start = addMinutes(startDate, 300)
    const pause1End = addMinutes(pause1Start, 30)
    segments.push({
      start: format(pause1Start, "yyyy-MM-dd'T'HH:mm"),
      end: format(pause1End, "yyyy-MM-dd'T'HH:mm")
    })
  }

  // Pause 2: nach 9 Stunden (540 Minuten) Arbeitszeit + 30 Min Pause 1 = 570 Minuten
  if (requiredMinutes >= 45) {
    const pause2Start = addMinutes(startDate, 570) // 540 + 30 (Pause 1)
    const pause2End = addMinutes(pause2Start, 15)
    segments.push({
      start: format(pause2Start, "yyyy-MM-dd'T'HH:mm"),
      end: format(pause2End, "yyyy-MM-dd'T'HH:mm")
    })
  }

  // Pause 3: nach 9,5 Stunden (570 Minuten) Arbeitszeit + 30 Min Pause 1 + 15 Min Pause 2 = 615 Minuten
  if (requiredMinutes >= 60) {
    const pause3Start = addMinutes(startDate, 615) // 570 + 15 (Pause 2) + 30 Arbeitsminuten
    const pause3End = addMinutes(pause3Start, 15)
    segments.push({
      start: format(pause3Start, "yyyy-MM-dd'T'HH:mm"),
      end: format(pause3End, "yyyy-MM-dd'T'HH:mm")
    })
  }

  return segments
}

/**
 * Berechnet die Gesamtpausendauer aus Pausensegmenten
 * @param breakSegments - Array von Pausensegmenten
 * @returns Gesamtpausendauer in Minuten
 */
export function calculateBreakTotalMinutes(breakSegments: BreakSegment[]): number {
  return breakSegments.reduce((total, segment) => {
    const start = new Date(segment.start)
    const end = new Date(segment.end)
    return total + (end.getTime() - start.getTime()) / (1000 * 60)
  }, 0)
}

/**
 * Prüft, ob ein Zeitpunkt innerhalb eines Pausensegments liegt
 * @param date - Zu prüfender Zeitpunkt
 * @param breakSegments - Array von Pausensegmenten
 * @returns true wenn der Zeitpunkt in einer Pause liegt
 */
export function isInBreak(date: Date, breakSegments: BreakSegment[]): boolean {
  return breakSegments.some(segment => {
    const start = new Date(segment.start)
    const end = new Date(segment.end)
    return date >= start && date < end
  })
}

/**
 * Prüft, ob ein Zeitpunkt in der Nachtzeit liegt (23:00 - 06:00)
 * @param date - Zu prüfender Zeitpunkt
 * @returns true wenn Nachtzeit
 */
export function isNightTime(date: Date): boolean {
  const hour = date.getHours()
  return hour >= 23 || hour < 6
}

/**
 * Prüft, ob ein Zeitpunkt an einem Sonntag liegt
 * @param date - Zu prüfender Zeitpunkt
 * @returns true wenn Sonntag
 */
export function isSundayTime(date: Date): boolean {
  return date.getDay() === 0
}

/**
 * Prüft, ob ein Datum ein Feiertag ist
 * @param date - Zu prüfendes Datum
 * @param holidays - Array von Feiertagen im Format YYYY-MM-DD
 * @returns true wenn Feiertag
 */
export function isHolidayDate(date: Date, holidays: string[]): boolean {
  const dateStr = format(date, 'yyyy-MM-dd')
  return holidays.includes(dateStr)
}
