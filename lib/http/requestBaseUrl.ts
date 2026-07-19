import { NextRequest } from 'next/server'

/**
 * Basis-URL für in E-Mails versendete Links (Einladungen, Passwort-Reset).
 *
 * Primär wird die Domain verwendet, unter der die Anfrage tatsächlich
 * eingegangen ist (x-forwarded-host / host). Damit zeigen Links immer auf die
 * gerade genutzte, erreichbare Domain – auch wenn NEXT_PUBLIC_BASE_URL auf eine
 * veraltete/nicht aufgelöste Domain gesetzt ist. Fallbacks: NEXT_PUBLIC_BASE_URL,
 * dann der Request-Origin.
 */
export function getRequestBaseUrl(req: NextRequest): string {
  const forwardedHost = req.headers.get('x-forwarded-host')
  const host = (forwardedHost || req.headers.get('host') || '').trim()

  if (host) {
    const isLocal = host.startsWith('localhost') || host.startsWith('127.') || host.startsWith('0.0.0.0')
    const proto = (req.headers.get('x-forwarded-proto') || (isLocal ? 'http' : 'https'))
      .split(',')[0]
      .trim()
    return `${proto}://${host}`
  }

  // Fallbacks, falls keine Host-Header vorhanden sind
  if (process.env.NEXT_PUBLIC_BASE_URL) return process.env.NEXT_PUBLIC_BASE_URL
  return req.nextUrl.origin
}
