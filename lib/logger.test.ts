import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import { logger } from './logger'

const ORIGINAL_LOG_LEVEL = process.env.LOG_LEVEL

describe('logger', () => {
  beforeEach(() => {
    process.env.LOG_LEVEL = 'debug'
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
    process.env.LOG_LEVEL = ORIGINAL_LOG_LEVEL
  })

  test('maskiert sensible Felder im Meta-Objekt', () => {
    logger.info('login', { password: 'secret', token: 'abc', user: 'bob' })
    const output = (console.log as any).mock.calls[0][0] as string
    expect(output).toContain('"password":"[redacted]"')
    expect(output).toContain('"token":"[redacted]"')
    expect(output).toContain('"user":"bob"')
    expect(output).not.toContain('secret')
    expect(output).not.toContain('abc')
  })

  test('maskiert verschachtelte sensible Felder', () => {
    logger.info('nested', { data: { apiKey: 'xyz', name: 'ok' } })
    const output = (console.log as any).mock.calls[0][0] as string
    expect(output).toContain('"apiKey":"[redacted]"')
    expect(output).toContain('"name":"ok"')
    expect(output).not.toContain('xyz')
  })

  test('normalisiert Error-Objekte auf error-Level', () => {
    logger.error('boom', new Error('kaputt'))
    const output = (console.error as any).mock.calls[0][0] as string
    expect(output).toContain('"level":"error"')
    expect(output).toContain('kaputt')
  })

  test('unterdrückt debug-Logs unterhalb des Schwellwerts', () => {
    process.env.LOG_LEVEL = 'warn'
    logger.debug('leise')
    logger.info('auch leise')
    logger.warn('laut')
    expect((console.log as any).mock.calls.length).toBe(0)
    expect((console.warn as any).mock.calls.length).toBe(1)
  })
})
