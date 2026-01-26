/**
 * TimeEntry Types - Wiederverwendbare Typen für Zeiteinträge
 * @module lib/timeEntry/types
 */

import type { MitarbeiterFunktion } from '@/types'

/**
 * Erweiterter TimeEntry-Typ mit Sonntagsstunden
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
