import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import { checkRateLimit } from './rateLimit'

// Ohne UPSTASH_*-Env nutzt checkRateLimit den In-Memory-Fallback.
describe('checkRateLimit – In-Memory-Fallback', () => {
  beforeEach(() => {
    delete process.env.UPSTASH_REDIS_REST_URL
    delete process.env.UPSTASH_REDIS_REST_TOKEN
  })

  test('erlaubt Requests bis zum Limit und blockt danach', async () => {
    const key = `test:${Math.random()}`
    const first = await checkRateLimit(key, 2, 60_000)
    const second = await checkRateLimit(key, 2, 60_000)
    const third = await checkRateLimit(key, 2, 60_000)

    expect(first.allowed).toBe(true)
    expect(second.allowed).toBe(true)
    expect(third.allowed).toBe(false)
    expect(third.retryAfterSec).toBeGreaterThan(0)
  })

  test('getrennte Keys haben unabhängige Zähler', async () => {
    const a = `a:${Math.random()}`
    const b = `b:${Math.random()}`
    await checkRateLimit(a, 1, 60_000) // a ausgeschöpft
    const blockedA = await checkRateLimit(a, 1, 60_000)
    const freshB = await checkRateLimit(b, 1, 60_000)

    expect(blockedA.allowed).toBe(false)
    expect(freshB.allowed).toBe(true)
  })

  test('nach Ablauf des Fensters wird wieder erlaubt', async () => {
    vi.useFakeTimers()
    try {
      const key = `window:${Math.random()}`
      await checkRateLimit(key, 1, 1_000)
      const blocked = await checkRateLimit(key, 1, 1_000)
      expect(blocked.allowed).toBe(false)

      // Zeit über das Fenster hinaus vorspulen
      vi.advanceTimersByTime(1_500)
      const afterReset = await checkRateLimit(key, 1, 1_000)
      expect(afterReset.allowed).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })
})
