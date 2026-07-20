/**
 * Reine, testbare Validierung für GAEB-Datei-Uploads (keine UI-/IO-Logik).
 *
 * GAEB DA XML wird in der Praxis mit unterschiedlichen Endungen ausgeliefert
 * (z.B. .x81/.x83/.x86, .p8x, .d8x oder generisch .xml). MIME-Typen sind
 * unzuverlässig (oft application/octet-stream), daher primär Endungs-basiert.
 */

/** Erlaubte Dateiendungen (Kleinschreibung, ohne Punkt-Präfix-Prüfung). */
export const GAEB_ALLOWED_EXTENSIONS = [
  'xml',
  'x81', 'x82', 'x83', 'x84', 'x85', 'x86', 'x87', 'x88', 'x89',
  'p81', 'p82', 'p83', 'p84', 'p85', 'p86', 'p87', 'p88', 'p89',
  'd81', 'd82', 'd83', 'd84', 'd85', 'd86', 'd87', 'd88', 'd89',
]

export function getFileExtension(name: string): string {
  const idx = name.lastIndexOf('.')
  return idx >= 0 ? name.slice(idx + 1).toLowerCase() : ''
}

export interface GaebUploadValidationInput {
  name: string
  sizeBytes: number
  maxFileSizeBytes: number
}

export interface GaebUploadValidation {
  ok: boolean
  error?: string
}

export function validateGaebUpload(input: GaebUploadValidationInput): GaebUploadValidation {
  const { name, sizeBytes, maxFileSizeBytes } = input
  if (!name || name.trim().length === 0) {
    return { ok: false, error: 'Kein Dateiname angegeben' }
  }
  if (sizeBytes <= 0) {
    return { ok: false, error: 'Leere Datei' }
  }
  if (sizeBytes > maxFileSizeBytes) {
    const mb = Math.round(maxFileSizeBytes / (1024 * 1024))
    return { ok: false, error: `Datei zu groß (max. ${mb} MB)` }
  }
  const ext = getFileExtension(name)
  if (!GAEB_ALLOWED_EXTENSIONS.includes(ext)) {
    return { ok: false, error: `Unzulässige Dateiendung: .${ext || '?'} (erlaubt: GAEB DA XML)` }
  }
  return { ok: true }
}
