import { XMLParser } from 'fast-xml-parser'

/**
 * Sicheres Laden von GAEB-XML.
 *
 * Security:
 * - fast-xml-parser löst KEINE externen Entities/DTDs auf (kein XXE).
 * - DOCTYPE/ENTITY wird zusätzlich abgelehnt (Schutz vor Entity-Expansion /
 *   „billion laughs").
 * - Größenlimit wird vom Aufrufer geprüft; hier zusätzliche Obergrenze.
 * - Namespaces werden entfernt (GAEB nutzt Default-Namespace pro DA-Phase).
 */

const MAX_XML_BYTES = 60 * 1024 * 1024

export interface SecureXmlResult {
  ok: boolean
  data?: unknown
  error?: string
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: true,
  // Interne Entity-Verarbeitung deaktivieren (Schutz vor Expansion)
  processEntities: false,
  // Werte als Strings belassen (verhindert Verlust führender Nullen bei OZ etc.);
  // Zahlen werden gezielt über parseNumber() im Parser interpretiert.
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
})

export function parseSecureXml(raw: string): SecureXmlResult {
  if (!raw || raw.trim().length === 0) {
    return { ok: false, error: 'Leere Datei' }
  }
  if (Buffer.byteLength(raw, 'utf8') > MAX_XML_BYTES) {
    return { ok: false, error: 'Datei überschreitet die maximale XML-Größe' }
  }
  // DTD/Entity-Deklarationen ablehnen (XXE / Entity-Expansion)
  const head = raw.slice(0, 4096).toLowerCase()
  if (head.includes('<!doctype') || head.includes('<!entity')) {
    return { ok: false, error: 'DOCTYPE/ENTITY in GAEB-Dateien nicht zulässig (Sicherheit)' }
  }

  try {
    const data = parser.parse(raw)
    return { ok: true, data }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'XML konnte nicht geparst werden' }
  }
}
