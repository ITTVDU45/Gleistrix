import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { checkRateLimit } from '@/lib/rateLimit'

// Rate-Limit-Parameter (Store: In-Memory oder Upstash, siehe shared/rateLimit)
const windowMs = 60_000
const defaultMax = 100
const authMax = 20

function getClientIp(req: NextRequest): string {
  const xf = req.headers.get('x-forwarded-for')
  if (xf) return xf.split(',')[0].trim()
  return '0.0.0.0'
}

/** Öffentlich erreichbare Pfade (ohne Login) */
const PUBLIC_PATHS = ['/login', '/auth/set-password']

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const method = req.method.toUpperCase()
  const isApi = pathname.startsWith('/api/')
  const isMutating = isApi && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)

  // Nonce pro Request (CSP)
  const nonceBytes = new Uint8Array(16)
  globalThis.crypto.getRandomValues(nonceBytes)
  const nonce = btoa(String.fromCharCode(...nonceBytes))
  const reqHeaders = new Headers(req.headers)
  reqHeaders.set('x-nonce', nonce)

  const res = NextResponse.next({ request: { headers: reqHeaders } })

  const csp = (process.env.NODE_ENV === 'production'
    ? [
        "default-src 'self'",
        `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https: blob:`,
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob:",
        "connect-src 'self' ws: wss: https:",
        "font-src 'self' data:",
        "object-src 'none'",
        "base-uri 'self'",
        "frame-ancestors 'none'",
      ]
    : [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: http: https:",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob: https:",
        "connect-src 'self' ws: wss: http: https:",
        "font-src 'self' data:",
        "worker-src 'self' blob:",
        "object-src 'none'",
        "base-uri 'self'",
        "frame-ancestors 'none'",
      ]
  ).join('; ')
  reqHeaders.set('Content-Security-Policy', csp)
  res.headers.set('Content-Security-Policy', csp)

  if (process.env.NODE_ENV === 'production') {
    res.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload')
  }
  res.headers.set('X-Content-Type-Options', 'nosniff')
  res.headers.set('X-Frame-Options', 'DENY')
  res.headers.set('Referrer-Policy', 'no-referrer')
  res.headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()')

  // Seiten-Gating: Portal nur mit Login (öffentlich: Login + Einladungsannahme)
  if (!isApi) {
    const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
    if (!token && !isPublic) {
      return NextResponse.redirect(new URL('/login', req.url))
    }
    if (token && pathname === '/login') {
      return NextResponse.redirect(new URL('/', req.url))
    }
  }

  // Rate-Limit nur für mutierende API-Requests
  if (!isMutating) {
    return res
  }

  const ip = getClientIp(req)
  const isAuthEndpoint = pathname.startsWith('/api/auth')
  const max = isAuthEndpoint ? authMax : defaultMax
  const scope = isAuthEndpoint ? 'auth' : 'api'
  const key = `${scope}:${ip}`

  const result = await checkRateLimit(key, max, windowMs)
  if (!result.allowed) {
    const limited = NextResponse.json(
      { error: 'Rate limit überschritten. Bitte später erneut versuchen.' },
      { status: 429 }
    )
    limited.headers.set('Retry-After', String(result.retryAfterSec))
    return limited
  }
  return res
}

export const config = {
  matcher: [
    '/',
    '/(login|auth|projekte|einsaetze|rechnungen|dokumente|unternehmen)/:path*',
    '/api/:path*',
  ],
}
