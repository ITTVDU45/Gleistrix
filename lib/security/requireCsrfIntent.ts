import { NextRequest } from 'next/server'
import type { IntentKey } from '@/lib/http/fetchWithIntent'

/**
 * CSRF-Härtung nach Bestandsmuster (siehe invite/create-user): mutierende
 * Endpunkte verlangen in Produktion den passenden `x-csrf-intent`-Header,
 * den nur der eigene Client (fetchWithIntent) setzt. In Dev/Test ohne
 * Wirkung, damit Tools und Tests nicht blockiert werden.
 */
export function hasValidCsrfIntent(req: NextRequest, intent: IntentKey): boolean {
  if (process.env.NODE_ENV !== 'production') return true
  return req.headers.get('x-csrf-intent') === intent
}
