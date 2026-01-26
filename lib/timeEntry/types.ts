/**
 * TimeEntry Types - Wiederverwendbare Typen für Zeiteinträge
 * @module lib/timeEntry/types
 */

import type { MitarbeiterFunktion } from '@/types/main'

/**
 * Pausenabschnitt (Start/Ende als ISO-String)
 */
export interface BreakSegment {
  start: string  // ISO-String (YYYY-MM-DDTHH:mm)
  end: string    // ISO-String
}

/**
 * Berechnete Zuschläge (in Minuten)
 */
export interface ComputedPremiums {
  nightMinutes: number        // Nachtstunden (23:00-06:00, nicht Feiertag)
  sundayMinutes: number       // Sonntagsstunden (nicht Feiertag)
  holidayMinutes: number      // Feiertagsstunden (nicht Nacht)
  nightHolidayMinutes: number // Nacht + Feiertag kombiniert
  sundayHolidayMinutes: number // Sonntag + Feiertag kombiniert
  normalMinutes: number       // Reguläre Arbeitsstunden
  totalWorkMinutes: number    // Gesamtarbeitszeit (ohne Pausen)
  breakTotalMinutes: number   // Gesamtpause in Minuten
}

/**
 * Ergebnis der Segment-Analyse
 */
export interface SegmentAnalysis extends ComputedPremiums {
  segments: Array<{
    minute: Date
    isNight: boolean
    isSunday: boolean
    isHoliday: boolean
    isBreak: boolean
  }>
}

/**
 * Berechnetes TimeEntry-Ergebnis
 */
export interface ComputedTimeEntry {
  startISO: string
  endISO: string
  totalDurationMinutes: number  // Gesamtdauer inkl. Pausen
  paidDurationMinutes: number   // Bezahlte Arbeitszeit (ohne Pausen)
  breakSegments: BreakSegment[]
  breakTotalMinutes: number
  premiums: ComputedPremiums
  overrideBreaks: boolean
}

/**
 * Erweiterter TimeEntry-Typ mit Sonntagsstunden und Pausensegmenten
 */
export interface TimeEntryWithSunday {
  id: string
  name: string
  funktion: MitarbeiterFunktion | string
  start: string // ISO-String (YYYY-MM-DDTHH:mm)
  ende: string // ISO-String
  stunden: number
  pause: string
  extra: number
  fahrtstunden: number
  feiertag: number // Anzahl Feiertagsstunden
  sonntag: number // 0 oder 1
  sonntagsstunden: number
  bemerkung: string
  nachtzulage: string
  // Neue Felder für automatische Pausenberechnung
  breakSegments?: BreakSegment[]
  breakTotalMinutes?: number
  overrideBreaks?: boolean
  // Berechnete Zuschläge in Minuten
  nightMinutes?: number
  sundayMinutes?: number
  holidayMinutes?: number
  nightHolidayMinutes?: number
  normalMinutes?: number
}

/**
 * Parameter für die Entry-Erstellung
 */
export interface BuildEntryParams {
  name: string
  funktion: string
  day: string // YYYY-MM-DD
  startTime: string // HH:mm
  endTime: string // HH:mm
  pause: string
  extra: string
  fahrtstunden: string
  bemerkung: string
  isMultiDay: boolean
  isHoliday: boolean
  isSunday: boolean
  initialEntryId?: string
}

/**
 * Ergebnis eines Batch-Prozesses
 */
export interface BatchResult<T> {
  success: boolean
  results: Array<{
    status: 'fulfilled' | 'rejected'
    value?: T
    reason?: Error
    employeeName: string
  }>
  totalProcessed: number
  successCount: number
  errorCount: number
  errors: Array<{ employeeName: string; error: Error }>
}

/**
 * Callback für Batch-Fortschritt
 */
export type BatchProgressCallback = (processed: number, total: number) => void
