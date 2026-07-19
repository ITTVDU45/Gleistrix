/**
 * Schlanker, dependency-freier Logger (Node- und Edge-kompatibel).
 *
 * Ziele:
 *  - Level-Steuerung: in Production standardmäßig ab `info`, in Dev ab `debug`.
 *    Überschreibbar via `LOG_LEVEL` (debug|info|warn|error).
 *  - Redaction: Felder wie password/token/secret werden in Meta-Objekten
 *    automatisch maskiert, damit keine Geheimnisse in die Logs geraten.
 *  - Strukturierte Ausgabe (JSON) für bessere Auswertbarkeit in Vercel-Logs.
 *
 * Migration: `console.*` sollte schrittweise durch `logger.*` ersetzt werden.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LEVELS: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 }

function resolveThreshold(): number {
  const configured = (process.env.LOG_LEVEL as LogLevel | undefined)?.toLowerCase() as LogLevel | undefined
  if (configured && configured in LEVELS) return LEVELS[configured]
  return process.env.NODE_ENV === 'production' ? LEVELS.info : LEVELS.debug
}

const SENSITIVE_KEY = /pass(word)?|token|secret|authorization|cookie|apikey|api_key/i

function redact(value: unknown, depth = 0): unknown {
  if (depth > 4 || value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1))
  const out: Record<string, unknown> = {}
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    out[key] = SENSITIVE_KEY.test(key) ? '[redacted]' : redact(val, depth + 1)
  }
  return out
}

function normalizeError(err: unknown): unknown {
  if (err instanceof Error) {
    return { name: err.name, message: err.message, stack: err.stack }
  }
  return err
}

function emit(level: LogLevel, msg: string, meta?: unknown): void {
  if (LEVELS[level] < resolveThreshold()) return
  const entry: Record<string, unknown> = { t: new Date().toISOString(), level, msg }
  if (meta !== undefined) {
    entry.meta = redact(level === 'error' || level === 'warn' ? normalizeError(meta) : meta)
  }
  const line = JSON.stringify(entry)
  if (level === 'error') console.error(line)
  else if (level === 'warn') console.warn(line)
  else console.log(line)
}

export const logger = {
  debug: (msg: string, meta?: unknown) => emit('debug', msg, meta),
  info: (msg: string, meta?: unknown) => emit('info', msg, meta),
  warn: (msg: string, meta?: unknown) => emit('warn', msg, meta),
  error: (msg: string, meta?: unknown) => emit('error', msg, meta),
}
