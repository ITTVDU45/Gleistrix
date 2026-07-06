/**
 * QR-Code-Scan-URLs für das Lagermodul.
 *
 * Der QR-Code auf einem Etikett kodiert eine URL, die den Lagerarbeiter
 * direkt in die Lager-App (/lager/app) zum passenden Artikel bzw. zur Unit
 * führt. Dort wird ein Aktions-Screen (Ausgabe · Eingang · Inventur · Wartung)
 * geöffnet. Als Kennung dient die stabile DB-ID (_id).
 *
 * Format: {origin}/lager/app?a=<articleId>[&u=<unitId>]
 */

const SCAN_PATH = '/lager/app'

function resolveOrigin(origin?: string): string {
  if (origin && origin.trim()) return origin.replace(/\/+$/, '')
  if (typeof window !== 'undefined' && window.location?.origin) return window.location.origin
  return ''
}

export function buildLagerScanUrl(articleId?: string, unitId?: string, origin?: string): string {
  const id = (articleId ?? '').trim()
  if (!id) return ''
  const base = resolveOrigin(origin)
  const params = new URLSearchParams({ a: id })
  const unit = (unitId ?? '').trim()
  if (unit) params.set('u', unit)
  return `${base}${SCAN_PATH}?${params.toString()}`
}

export interface LagerScanTarget {
  articleId: string
  unitId?: string
}

export function parseLagerScanUrl(code: string): LagerScanTarget | null {
  const raw = (code ?? '').trim()
  if (!raw) return null
  try {
    // Absolute URL (native Kamera-Scan) oder relativer Pfad
    const url = raw.startsWith('http')
      ? new URL(raw)
      : new URL(raw, 'http://placeholder.local')
    if (!url.pathname.includes(SCAN_PATH)) return null
    const articleId = url.searchParams.get('a')?.trim()
    if (!articleId) return null
    const unitId = url.searchParams.get('u')?.trim() || undefined
    return { articleId, unitId }
  } catch {
    return null
  }
}
