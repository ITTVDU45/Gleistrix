import { describe, expect, test } from 'vitest'
import { NextRequest } from 'next/server'
import { getRequestBaseUrl } from './requestBaseUrl'

const req = (url: string, headers: Record<string, string>) =>
  new NextRequest(url, { headers })

describe('getRequestBaseUrl', () => {
  test('nutzt x-forwarded-host + x-forwarded-proto (Vercel-Fall)', () => {
    const r = req('https://intern.local/api/x', {
      'x-forwarded-host': 'app.example.de',
      'x-forwarded-proto': 'https',
      host: 'intern.local',
    })
    expect(getRequestBaseUrl(r)).toBe('https://app.example.de')
  })

  test('fällt auf host-Header zurück, wenn kein x-forwarded-host', () => {
    const r = req('https://egal/api/x', { host: 'zeiterfassung.example.de' })
    expect(getRequestBaseUrl(r)).toBe('https://zeiterfassung.example.de')
  })

  test('localhost erhält http', () => {
    const r = req('http://localhost:3000/api/x', { host: 'localhost:3000' })
    expect(getRequestBaseUrl(r)).toBe('http://localhost:3000')
  })

  test('mehrere x-forwarded-proto-Werte → erster gewinnt', () => {
    const r = req('https://egal/api/x', {
      'x-forwarded-host': 'app.example.de',
      'x-forwarded-proto': 'https, http',
    })
    expect(getRequestBaseUrl(r)).toBe('https://app.example.de')
  })

  test('ohne Host-Header Fallback auf Request-Origin', () => {
    // NextRequest setzt host aus der URL, daher explizit ohne Header-Host testen
    const r = new NextRequest('https://fallback.example.de/api/x')
    expect(getRequestBaseUrl(r)).toBe('https://fallback.example.de')
  })
})
