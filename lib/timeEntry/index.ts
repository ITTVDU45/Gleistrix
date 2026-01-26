/**
 * TimeEntry Module - Zentrale Exports für Zeiteintrag-Funktionalität
 * @module lib/timeEntry
 * 
 * Dieses Modul bietet wiederverwendbare Funktionen für:
 * - Berechnung von Arbeitszeiten, Nacht- und Sonntagszuschlägen
 * - Erstellung von TimeEntry-Objekten
 * - Parallele Batch-Verarbeitung von Zeiteinträgen
 * 
 * @example
 * ```typescript
 * import { 
 *   buildTimeEntry, 
 *   processBatch, 
 *   calculateSundayHours 
 * } from '@/lib/timeEntry'
 * 
 * // Einzelnen Entry erstellen
 * const entry = buildTimeEntry({
 *   name: 'Max Mustermann',
 *   funktion: 'SIPO',
 *   day: '2024-01-15',
 *   startTime: '08:00',
 *   endTime: '16:00',
 *   pause: '0,5',
 *   extra: '0',
 *   fahrtstunden: '0,5',
 *   bemerkung: '',
 *   isMultiDay: false,
 *   isHoliday: false,
 *   isSunday: false
 * })
 * 
 * // Batch parallel verarbeiten
 * const result = await processBatch(tasks, employeeNames)
 * ```
 */

// Types
export type {
  TimeEntryWithSunday,
  BuildEntryParams,
  BatchResult,
  BatchProgressCallback
} from './types'

// Calculation utilities
export {
  calculateHoursForDay,
  calculateNightBonus,
  calculateSundayHours,
  calculateHolidayHours,
  parseNumber
} from './calculateTimeValues'

// Entry builder
export {
  buildTimeEntry,
  buildTimeEntriesForDays,
  prepareBatchPayloads
} from './buildTimeEntry'

// Batch processing
export {
  processBatch,
  processBatchWithRateLimit,
  formatBatchErrorReport,
  type RetryConfig
} from './batchProcessor'
