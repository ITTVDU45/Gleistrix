/**
 * Schlanker, dependency-freier Logger (Node- und Edge-kompatibel).
 *
 * Ziele:
 *  - Level-Steuerung: in Production standardmäßig ab `info`, in Dev ab `debug`.
 *    Überschreibbar via `LOG_LEVEL` (debug|info|warn|error). Dadurch werden
 *    `logger.debug`-Aufrufe in Production automatisch unterdrückt.
 *  - Redaction: Felder wie password/token/secret werden in Meta-Objekten
 *    automatisch maskiert, damit keine Geheimnisse in die Logs geraten.
 *  - Drop-in für `console`: variadische Argumente; das erste String-Argument
 *    ist die Message, der Rest ist Meta.
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
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack }
  }
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1))
  const out: Record<string, unknown> = {}
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    out[key] = SENSITIVE_KEY.test(key) ? '[redacted]' : redact(val, depth + 1)
  }
  return out
}

function emit(level: LogLevel, args: unknown[]): void {
  if (LEVELS[level] < resolveThreshold()) return

  const [first, ...rest] = args
  const msg = typeof first === 'string' ? first : ''
  const metaArgs = typeof first === 'string' ? rest : args

  const entry: Record<string, unknown> = { t: new Date().toISOString(), level, msg }
  if (metaArgs.length === 1) {
    entry.meta = redact(metaArgs[0])
  } else if (metaArgs.length > 1) {
    entry.meta = metaArgs.map((m) => redact(m))
  }

  const line = JSON.stringify(entry)
  if (level === 'error') console.error(line)
  else if (level === 'warn') console.warn(line)
  else console.log(line)
}

export const logger = {
  debug: (...args: unknown[]) => emit('debug', args),
  info: (...args: unknown[]) => emit('info', args),
  warn: (...args: unknown[]) => emit('warn', args),
  error: (...args: unknown[]) => emit('error', args),
}
