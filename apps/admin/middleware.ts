import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { checkRateLimit } from '@/lib/rateLimit';

// Rate-Limit-Parameter (Store: In-Memory oder Upstash, siehe lib/rateLimit.ts)
const windowMs = 60_000; // 1 Minute
const defaultMax = 100; // Standardlimit für mutierende API-Calls
const authMax = 20; // Strengeres Limit für Auth-Endpunkte

function getClientIp(req: NextRequest): string {
  const xf = req.headers.get('x-forwarded-for');
  if (xf) return xf.split(',')[0].trim();
  // Next.js stellt ggf. req.ip bereit; als Fallback anonymisieren
  return (req as any).ip || '0.0.0.0';
}

export async function middleware(req: NextRequest) {
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
  // Prod: Nonce + 'strict-dynamic' statt 'unsafe-inline' → deutlich stärkerer
  //       XSS-Schutz. Next.js liest den Nonce aus der CSP auf den Request-Headern
  //       (siehe reqHeaders unten) und versieht seine eigenen <script>-Tags damit.
  //       'https:'/'blob:' bleiben als Fallback für Browser ohne strict-dynamic-Support;
  //       moderne Browser ignorieren sie zugunsten der Nonce-Propagation.
  // Dev:  'unsafe-eval'/'unsafe-inline' für React Refresh / HMR nötig.
  const csp = (process.env.NODE_ENV === 'production'
    ? [
        "default-src 'self'",
        `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https: blob:`,
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob:",
        // Externe Verbindungen erlauben (z. B. Next intern, Vercel)
        "connect-src 'self' ws: wss: https:",
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
  // CSP auch auf den Request-Headern setzen: nur so übernimmt Next.js den Nonce
  // automatisch für seine gestreamten/gebündelten Skripte.
  reqHeaders.set('Content-Security-Policy', csp);
  res.headers.set('Content-Security-Policy', csp);

  // HSTS nur in Prod setzen
  if (process.env.NODE_ENV === 'production') {
    res.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  }
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('Referrer-Policy', 'no-referrer');
  // Kamera nur für mobile Lager-App erlauben (QR-Scan, Lieferschein-Foto)
  const permissionsPolicy = pathname.startsWith('/lager/app')
    ? 'geolocation=(), microphone=(), camera=(self)'
    : 'geolocation=(), microphone=(), camera=()';
  res.headers.set('Permissions-Policy', permissionsPolicy);

  // Health-Endpoint oder explizit markierte Antworten unverändert durchlassen
  if (pathname === '/api/health' || req.headers.get('x-no-app-shell') === '1') {
    return res;
  }

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const currentRole = (token as { role?: string } | null)?.role;
  if (pathname.startsWith('/finanzen') && currentRole && currentRole !== 'superadmin') {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }
  // Subunternehmen-Konten gehören ins separate Portal (eigene App/Domain).
  // Der Login lehnt die Rolle bereits ab; bestehende Alt-Sessions werden hier
  // auf die Portal-URL umgeleitet.
  if (currentRole === 'subunternehmen' && !pathname.startsWith('/api/')) {
    const portalUrl = process.env.PORTAL_BASE_URL || 'http://localhost:3001';
    return NextResponse.redirect(new URL(portalUrl));
  }

  const isLagerUser = currentRole === 'lager';
  const isLagerAppRoute = pathname.startsWith('/lager/app');
  const isLagerAdminRoute = pathname === '/lager' || pathname.startsWith('/lager/');
  const isBlockedForLager = (
    pathname.startsWith('/dashboard')
    || pathname.startsWith('/mitarbeiter')
    || pathname.startsWith('/fahrzeuge')
    || pathname.startsWith('/timetracking')
    || pathname.startsWith('/projekte')
    || pathname.startsWith('/abbrechnung')
    || pathname.startsWith('/einstellungen')
  );

  // Lagerrolle wird konsequent in die mobile Lager-App geführt
  if (isLagerUser && (isBlockedForLager || (isLagerAdminRoute && !isLagerAppRoute))) {
    return NextResponse.redirect(new URL('/lager/app', req.url));
  }
  if (!isLagerUser && isLagerAppRoute && token) {
    return NextResponse.redirect(new URL('/dashboard', req.url));
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
  // Auth- und Standard-Limit in getrennten Buckets führen, sonst teilen sie
  // sich denselben IP-Zähler und beeinflussen sich gegenseitig.
  const scope = isAuthEndpoint ? 'auth' : 'api';
  const key = `${scope}:${ip}`;

  const result = await checkRateLimit(key, max, windowMs);
  if (!result.allowed) {
    const limited = NextResponse.json({ error: 'Rate limit überschritten. Bitte später erneut versuchen.' }, { status: 429 });
    limited.headers.set('Retry-After', String(result.retryAfterSec));
    return limited;
  }
  return res;
}

export const config = {
  matcher: [
    // App Routen explizit
    '/',
    '/(login|dashboard|projekte|abbrechnung|finanzen|mitarbeiter|fahrzeuge|projektdetail|timetracking|einstellungen|lager|plantafel|agenten|statistiken)/:path*',
    // API-Routen: ohne diesen Eintrag liefen Rate-Limiting (mutierende
    // Requests, strengeres Auth-Limit) und Security-Header nie für /api
    '/api/:path*',
  ],
};

