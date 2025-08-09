import { NextRequest, NextResponse } from 'next/server';

// Einfache In-Memory Rate-Limitierung (pro IP)
type Bucket = { count: number; resetAt: number };
const windowMs = 60_000; // 1 Minute
const defaultMax = 100; // Standardlimit für mutierende API-Calls
const authMax = 20; // Strengeres Limit für Auth-Endpunkte
const buckets = new Map<string, Bucket>();

function getClientIp(req: NextRequest): string {
  const xf = req.headers.get('x-forwarded-for');
  if (xf) return xf.split(',')[0].trim();
  // Next.js stellt ggf. req.ip bereit; als Fallback anonymisieren
  return (req as any).ip || '0.0.0.0';
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const method = req.method.toUpperCase();
  const isApi = pathname.startsWith('/api/');
  const isMutating = isApi && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);

  // Nonce pro Request generieren (Edge: Web Crypto API)
  const nonceBytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(nonceBytes);
  const nonce = btoa(String.fromCharCode(...nonceBytes));
  const reqHeaders = new Headers(req.headers);
  reqHeaders.set('x-nonce', nonce);

  // Weiterleitung vorbereiten, damit Downstream die Nonce lesen kann
  const res = NextResponse.next({ request: { headers: reqHeaders } });

  // Security Headers (CSP mit Nonce)
  // In Entwicklung muss 'unsafe-eval' für React Refresh / HMR erlaubt werden
  const csp = (process.env.NODE_ENV === 'production'
    ? [
        "default-src 'self'",
        `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob:",
        "connect-src 'self' ws: wss:",
        "font-src 'self' data:",
        "object-src 'none'",
        "base-uri 'self'",
        "frame-ancestors 'none'",
      ]
    : [
        "default-src 'self'",
        // Dev: erlaubte Skriptquellen für HMR/React Refresh
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
  ).join('; ');
  res.headers.set('Content-Security-Policy', csp);

  // HSTS nur in Prod setzen
  if (process.env.NODE_ENV === 'production') {
    res.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  }
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('Referrer-Policy', 'no-referrer');
  res.headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

  // Health-Endpoint oder explizit markierte Antworten unverändert durchlassen
  if (pathname === '/api/health' || req.headers.get('x-no-app-shell') === '1') {
    return res;
  }
  // Rate-Limit nur für mutierende API-Requests anwenden
  if (!isMutating) {
    return res;
  }

  // HMR / Next intern zulassen
  if (pathname.startsWith('/_next')) return res;

  const ip = getClientIp(req);
  const isAuthEndpoint = pathname.startsWith('/api/auth');
  const max = isAuthEndpoint ? authMax : defaultMax;
  const key = `${ip}`;

  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return res;
  }

  if (bucket.count >= max) {
    const limited = NextResponse.json({ error: 'Rate limit überschritten. Bitte später erneut versuchen.' }, { status: 429 });
    limited.headers.set('Retry-After', Math.ceil((bucket.resetAt - now) / 1000).toString());
    return limited;
  }
  bucket.count += 1;
  return res;
}

export const config = {
  matcher: [
    // App Routen explizit
    '/',
    '/(login|projekte|mitarbeiter|fahrzeuge|projektdetail|timetracking|einstellungen)/:path*',
  ],
};


