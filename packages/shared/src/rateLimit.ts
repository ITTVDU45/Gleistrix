/**
 * Fixed-Window Rate-Limiting für die Middleware (Edge-kompatibel).
 *
 * Standard: In-Memory pro Serverless-Instanz (bekannte Einschränkung – auf
 * Vercel hat jede Instanz ihren eigenen Zähler, siehe AUDIT S-10).
 *
 * Optional verteilt: Sind `UPSTASH_REDIS_REST_URL` und
 * `UPSTASH_REDIS_REST_TOKEN` gesetzt, wird ein gemeinsamer Zähler in Upstash
 * Redis über die REST-API geführt (funktioniert auf der Edge-Runtime via
 * fetch). Bei jedem Redis-Fehler wird bewusst *fail-open* gehandelt, damit ein
 * Redis-Ausfall nie die Anwendung blockiert.
 */

export interface RateLimitResult {
  allowed: boolean
  retryAfterSec: number
}

interface Bucket {
  count: number
  resetAt: number
}

// Modul-Singleton: bleibt pro Instanz über Requests erhalten.
const buckets = new Map<string, Bucket>()

function memoryLimit(key: string, max: number, windowMs: number): RateLimitResult {
  const now = Date.now()
  const bucket = buckets.get(key)

  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, retryAfterSec: 0 }
  }

  if (bucket.count >= max) {
    return { allowed: false, retryAfterSec: Math.ceil((bucket.resetAt - now) / 1000) }
  }

  bucket.count += 1
  return { allowed: true, retryAfterSec: 0 }
}

function upstashConfig(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  return { url: url.replace(/\/$/, ''), token }
}

async function upstashLimit(
  key: string,
  max: number,
  windowMs: number,
  config: { url: string; token: string }
): Promise<RateLimitResult> {
  const ttlSec = Math.max(1, Math.ceil(windowMs / 1000))
  try {
    // Fixed-Window: INCR erhöht den Zähler, EXPIRE ... NX setzt die TTL nur
    // beim ersten Treffer des Fensters (Redis 7 / Upstash).
    const res = await fetch(`${config.url}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([
        ['INCR', key],
        ['EXPIRE', key, String(ttlSec), 'NX'],
      ]),
    })

    if (!res.ok) return { allowed: true, retryAfterSec: 0 } // fail-open

    const data = (await res.json()) as Array<{ result?: number; error?: string }>
    const count = data?.[0]?.result ?? 0

    if (count > max) {
      return { allowed: false, retryAfterSec: ttlSec }
    }
    return { allowed: true, retryAfterSec: 0 }
  } catch {
    return { allowed: true, retryAfterSec: 0 } // fail-open bei Netzwerkfehler
  }
}

/**
 * Prüft und erhöht den Zähler für `key`. Nutzt Upstash falls konfiguriert,
 * sonst den In-Memory-Fallback.
 */
export async function checkRateLimit(
  key: string,
  max: number,
  windowMs: number
): Promise<RateLimitResult> {
  const config = upstashConfig()
  if (config) {
    return upstashLimit(key, max, windowMs, config)
  }
  return memoryLimit(key, max, windowMs)
}
