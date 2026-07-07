import { promises as fs } from 'fs'
import path from 'path'
import type { GaebValidationError } from '@/types/gaeb'

/**
 * Optionale XSD-Validierung gegen offizielle GAEB-Schemata.
 *
 * Bewusst deploy-sicher:
 * - `libxmljs2` (nativer Build) wird NUR zur Laufzeit geladen. Fehlt das Modul
 *   oder die XSD-Datei, wird `available: false` gemeldet und der Aufrufer nutzt
 *   die strukturelle Validierung als Fallback.
 * - Der Require ist bewusst nicht statisch analysierbar, damit der Next-Build
 *   auch ohne installiertes `libxmljs2` funktioniert.
 */

const XSD_ROOT = path.join(process.cwd(), 'lib', 'gaeb', 'xsd')

export interface XsdValidationOutcome {
  available: boolean
  reason?: string
  errors?: GaebValidationError[]
}

// Nicht statisch analysierbarer Require (verhindert Bundler-Auflösung).
function optionalRequire(moduleName: string): unknown {
  try {
    const req = Function('m', 'return require(m)') as (m: string) => unknown
    return req(moduleName)
  } catch {
    return null
  }
}

export async function validateAgainstXsd(
  rawXml: string,
  xsdPath?: string
): Promise<XsdValidationOutcome> {
  if (!xsdPath) {
    return { available: false, reason: 'Kein XSD-Pfad hinterlegt' }
  }

  const libxml = optionalRequire('libxmljs2') as
    | { parseXml: (s: string) => { validate: (schema: unknown) => boolean; validationErrors: unknown[] } }
    | null
  if (!libxml || typeof libxml.parseXml !== 'function') {
    return { available: false, reason: 'libxmljs2 nicht installiert – strukturelle Validierung wird verwendet' }
  }

  // Path-Traversal absichern: aufgelöster Pfad muss unterhalb von XSD_ROOT liegen
  const absXsd = path.resolve(XSD_ROOT, xsdPath)
  if (absXsd !== XSD_ROOT && !absXsd.startsWith(XSD_ROOT + path.sep)) {
    return { available: false, reason: 'Ungültiger XSD-Pfad' }
  }
  let xsdContent: string
  try {
    xsdContent = await fs.readFile(absXsd, 'utf8')
  } catch {
    return { available: false, reason: `XSD-Schema nicht gefunden: ${xsdPath}` }
  }

  try {
    const xmlDoc = libxml.parseXml(rawXml)
    const xsdDoc = libxml.parseXml(xsdContent)
    const valid = xmlDoc.validate(xsdDoc)
    if (valid) {
      return { available: true, errors: [] }
    }
    const errors: GaebValidationError[] = (xmlDoc.validationErrors || []).map((err) => {
      const e = err as { message?: string; line?: number; column?: number }
      return {
        code: 'XSD_VALIDATION',
        message: (e.message || 'XSD-Validierungsfehler').trim(),
        severity: 'fehler',
        line: e.line,
        column: e.column,
      }
    })
    return { available: true, errors }
  } catch (e) {
    return { available: false, reason: e instanceof Error ? e.message : 'XSD-Validierung fehlgeschlagen' }
  }
}
