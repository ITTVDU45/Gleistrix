/**
 * Batch Processor - Parallele Verarbeitung von Zeiteinträgen
 * @module lib/timeEntry/batchProcessor
 */

import type { BatchResult, BatchProgressCallback } from './types'

/**
 * Konfiguration für Retry-Verhalten
 */
export interface RetryConfig {
  maxRetries: number
  baseDelayMs: number
  maxDelayMs: number
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 500,
  maxDelayMs: 5000
}

/**
 * Prüft, ob ein Fehler ein transienter Netzwerkfehler ist, der wiederholt werden sollte
 */
function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase()
    // Netzwerkfehler
    if (message.includes('network') || message.includes('fetch')) return true
    if (message.includes('timeout') || message.includes('timed out')) return true
    if (message.includes('econnreset') || message.includes('econnrefused')) return true
    if (message.includes('socket') || message.includes('connection')) return true
    // Server-Fehler (5xx)
    if (message.includes('500') || message.includes('502') || message.includes('503') || message.includes('504')) return true
  }
  return false
}

/**
 * Berechnet die Verzögerung mit exponentiellem Backoff + Jitter
 */
function calculateBackoffDelay(attempt: number, config: RetryConfig): number {
  const exponentialDelay = config.baseDelayMs * Math.pow(2, attempt)
  const jitter = Math.random() * 0.3 * exponentialDelay // 0-30% Jitter
  return Math.min(exponentialDelay + jitter, config.maxDelayMs)
}

/**
 * Führt eine Funktion mit Retry-Logik aus
 */
async function executeWithRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<T> {
  let lastError: Error | undefined
  
  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      
      // Letzter Versuch oder nicht-retriable Fehler: werfen
      if (attempt === config.maxRetries || !isRetryableError(error)) {
        throw lastError
      }
      
      // Warte vor dem nächsten Versuch
      const delay = calculateBackoffDelay(attempt, config)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  
  throw lastError || new Error('Unbekannter Fehler nach Retry')
}

/**
 * Verarbeitet mehrere API-Calls parallel mit Promise.allSettled
 * Einzelne Fehler brechen nicht den gesamten Batch ab
 * Automatische Retry-Logik bei transienten Netzwerkfehlern
 * 
 * @param tasks - Array von async Funktionen, die ausgeführt werden sollen
 * @param employeeNames - Array von Mitarbeiternamen (für Fehler-Zuordnung)
 * @param onProgress - Optional: Callback für Fortschrittsanzeige
 * @param retryConfig - Optional: Konfiguration für Retry-Verhalten
 * @returns BatchResult mit Details zu Erfolgen und Fehlern
 */
export async function processBatch<T>(
  tasks: Array<() => Promise<T>>,
  employeeNames: string[],
  onProgress?: BatchProgressCallback,
  retryConfig?: Partial<RetryConfig>
): Promise<BatchResult<T>> {
  if (tasks.length === 0) {
    return {
      success: true,
      results: [],
      totalProcessed: 0,
      successCount: 0,
      errorCount: 0,
      errors: []
    }
  }

  const config = { ...DEFAULT_RETRY_CONFIG, ...retryConfig }

  // Alle Tasks parallel starten - mit Retry-Logik für transiente Fehler
  const results = await Promise.allSettled(
    tasks.map(task => executeWithRetry(task, config))
  )

  // Ergebnisse verarbeiten
  const processedResults = results.map((result, index) => ({
    status: result.status,
    value: result.status === 'fulfilled' ? result.value : undefined,
    reason: result.status === 'rejected' ? result.reason : undefined,
    employeeName: employeeNames[index] || `Unbekannt #${index}`
  }))

  const successCount = processedResults.filter(r => r.status === 'fulfilled').length
  const errorCount = processedResults.filter(r => r.status === 'rejected').length

  const errors = processedResults
    .filter(r => r.status === 'rejected')
    .map(r => ({
      employeeName: r.employeeName,
      error: r.reason instanceof Error ? r.reason : new Error(String(r.reason))
    }))

  // Fortschritt melden
  if (onProgress) {
    onProgress(tasks.length, tasks.length)
  }

  return {
    success: errorCount === 0,
    results: processedResults,
    totalProcessed: tasks.length,
    successCount,
    errorCount,
    errors
  }
}

/**
 * Führt eine Batch-Operation mit Rate-Limiting durch
 * Verhindert zu viele gleichzeitige Requests
 * Automatische Retry-Logik bei transienten Netzwerkfehlern
 * 
 * @param tasks - Array von async Funktionen
 * @param employeeNames - Mitarbeiternamen
 * @param concurrencyLimit - Maximale gleichzeitige Requests (default: 5)
 * @param onProgress - Fortschritts-Callback
 * @param retryConfig - Optional: Konfiguration für Retry-Verhalten
 * @returns BatchResult
 */
export async function processBatchWithRateLimit<T>(
  tasks: Array<() => Promise<T>>,
  employeeNames: string[],
  concurrencyLimit = 5,
  onProgress?: BatchProgressCallback,
  retryConfig?: Partial<RetryConfig>
): Promise<BatchResult<T>> {
  if (tasks.length === 0) {
    return {
      success: true,
      results: [],
      totalProcessed: 0,
      successCount: 0,
      errorCount: 0,
      errors: []
    }
  }

  const config = { ...DEFAULT_RETRY_CONFIG, ...retryConfig }

  const results: Array<{
    status: 'fulfilled' | 'rejected'
    value?: T
    reason?: Error
    employeeName: string
  }> = []

  let processed = 0

  // Verarbeite in Chunks
  for (let i = 0; i < tasks.length; i += concurrencyLimit) {
    const chunk = tasks.slice(i, i + concurrencyLimit)
    const chunkNames = employeeNames.slice(i, i + concurrencyLimit)

    // Mit Retry-Logik
    const chunkResults = await Promise.allSettled(
      chunk.map(task => executeWithRetry(task, config))
    )

    chunkResults.forEach((result, index) => {
      results.push({
        status: result.status,
        value: result.status === 'fulfilled' ? result.value : undefined,
        reason: result.status === 'rejected' ? result.reason : undefined,
        employeeName: chunkNames[index] || `Unbekannt #${i + index}`
      })
      processed++
      if (onProgress) {
        onProgress(processed, tasks.length)
      }
    })
  }

  const successCount = results.filter(r => r.status === 'fulfilled').length
  const errorCount = results.filter(r => r.status === 'rejected').length

  const errors = results
    .filter(r => r.status === 'rejected')
    .map(r => ({
      employeeName: r.employeeName,
      error: r.reason instanceof Error ? r.reason : new Error(String(r.reason))
    }))

  return {
    success: errorCount === 0,
    results,
    totalProcessed: tasks.length,
    successCount,
    errorCount,
    errors
  }
}

/**
 * Erstellt einen formatierten Fehlerbericht für die Anzeige
 * @param batchResult - Ergebnis des Batch-Prozesses
 * @returns Formatierter String mit Fehlerdetails
 */
export function formatBatchErrorReport<T>(batchResult: BatchResult<T>): string {
  if (batchResult.success) {
    return `Alle ${batchResult.totalProcessed} Einträge erfolgreich verarbeitet.`
  }

  const lines: string[] = [
    `${batchResult.successCount} von ${batchResult.totalProcessed} Einträgen erfolgreich.`,
    '',
    'Fehler:'
  ]

  batchResult.errors.forEach(({ employeeName, error }) => {
    lines.push(`- ${employeeName}: ${error.message}`)
  })

  return lines.join('\n')
}
