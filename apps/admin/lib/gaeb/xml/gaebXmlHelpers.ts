/**
 * Reine Hilfsfunktionen zum Navigieren/Extrahieren in geparsten GAEB-XML-Bäumen
 * (fast-xml-parser Ausgabe). Keine IO-/UI-Logik.
 */

export type XmlNode = Record<string, unknown> | unknown

/** Wert immer als Array normalisieren (fast-xml-parser liefert bei 1 Element ein Objekt). */
export function toArray<T = unknown>(value: unknown): T[] {
  if (value === undefined || value === null) return []
  return Array.isArray(value) ? (value as T[]) : [value as T]
}

/** Verschachtelten Pfad sicher lesen: getNested(obj, 'A', 'B', 'C'). */
export function getNested(obj: unknown, ...path: string[]): unknown {
  let cur: unknown = obj
  for (const key of path) {
    if (cur && typeof cur === 'object' && key in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[key]
    } else {
      return undefined
    }
  }
  return cur
}

/**
 * Extrahiert reinen Text aus GAEB-Textknoten. GAEB verschachtelt Texte oft als
 * p/span-Strukturen oder als #text-Knoten. Gibt getrimmten Klartext zurück.
 */
export function extractText(node: unknown, maxLen = 8000): string {
  const parts: string[] = []
  const visit = (n: unknown, depth: number) => {
    if (depth > 40 || parts.join(' ').length > maxLen) return
    if (n === null || n === undefined) return
    if (typeof n === 'string' || typeof n === 'number') {
      const s = String(n).trim()
      if (s) parts.push(s)
      return
    }
    if (Array.isArray(n)) {
      for (const item of n) visit(item, depth + 1)
      return
    }
    if (typeof n === 'object') {
      for (const [key, val] of Object.entries(n as Record<string, unknown>)) {
        if (key.startsWith('@_')) continue // Attribute überspringen
        visit(val, depth + 1)
      }
    }
  }
  visit(node, 0)
  return parts.join(' ').replace(/\s+/g, ' ').trim().slice(0, maxLen)
}

/** Zahl robust parsen (deutsche/englische Dezimaltrennung). */
export function parseNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined
  const raw = String(value).trim().replace(/\s/g, '')
  // "1.234,56" → "1234.56"; "1234.56" bleibt; "1234,56" → "1234.56"
  let normalized = raw
  if (raw.includes(',') && raw.includes('.')) {
    normalized = raw.replace(/\./g, '').replace(',', '.')
  } else if (raw.includes(',')) {
    normalized = raw.replace(',', '.')
  }
  const n = Number(normalized)
  return Number.isFinite(n) ? n : undefined
}
