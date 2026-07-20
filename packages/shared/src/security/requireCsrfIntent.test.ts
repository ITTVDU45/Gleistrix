import { afterEach, describe, expect, test, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { hasValidCsrfIntent } from './requireCsrfIntent'

const requestWith = (intent?: string) =>
  new NextRequest('http://localhost/api/test', {
    method: 'POST',
    headers: intent ? { 'x-csrf-intent': intent } : {},
  })

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('hasValidCsrfIntent', () => {
  test('in Produktion muss der Intent exakt passen', () => {
    vi.stubEnv('NODE_ENV', 'production')
    expect(hasValidCsrfIntent(requestWith('sub:invoice-create'), 'sub:invoice-create')).toBe(true)
    expect(hasValidCsrfIntent(requestWith('sub:invoice-delete'), 'sub:invoice-create')).toBe(false)
    expect(hasValidCsrfIntent(requestWith(undefined), 'sub:invoice-create')).toBe(false)
  })

  test('außerhalb von Produktion ohne Wirkung (Dev/Test blockieren nicht)', () => {
    vi.stubEnv('NODE_ENV', 'test')
    expect(hasValidCsrfIntent(requestWith(undefined), 'sub:invoice-create')).toBe(true)
  })
})
