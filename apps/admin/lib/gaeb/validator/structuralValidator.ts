import { getNested } from '@/lib/gaeb/xml/gaebXmlHelpers'
import type {
  GaebValidationResult,
  GaebValidationError,
  GaebVersionId,
  GaebExchangePhaseCode,
} from '@/types/gaeb'

/**
 * Strukturelle GAEB-Validierung (reine Funktion, keine XSD).
 *
 * Prüft die Grundstruktur von GAEB DA XML und erkennt Version + Austauschphase
 * aus der Datei selbst (nicht hartkodiert). Dient als deploy-sichere Basis und
 * als Fallback, wenn keine XSD-Validierung verfügbar ist.
 */
export function validateGaebStructure(parsed: unknown): GaebValidationResult {
  const errors: GaebValidationError[] = []
  const warnings: GaebValidationError[] = []
  const checkedAt = new Date().toISOString()

  const gaeb = getNested(parsed, 'GAEB')
  if (!gaeb) {
    errors.push({ code: 'GAEB_ROOT_MISSING', message: 'Kein <GAEB>-Wurzelelement gefunden', severity: 'fehler' })
    return { valid: false, errors, warnings, checkedAt }
  }

  // Version aus GAEBInfo/Version
  const versionRaw = getNested(gaeb, 'GAEBInfo', 'Version')
  const detectedVersion = versionRaw != null ? (String(versionRaw) as GaebVersionId) : undefined
  if (!detectedVersion) {
    warnings.push({ code: 'VERSION_UNKNOWN', message: 'GAEB-Version konnte nicht erkannt werden', severity: 'warnung' })
  }

  // Austauschphase aus Award/DP (Datenaustauschphase, z.B. 83 → X83)
  const dp = getNested(gaeb, 'Award', 'DP')
  let detectedPhase: GaebExchangePhaseCode | undefined
  if (dp != null) {
    const dpStr = String(dp).trim()
    detectedPhase = dpStr.toUpperCase().startsWith('X') ? dpStr.toUpperCase() : `X${dpStr}`
  } else {
    warnings.push({ code: 'PHASE_UNKNOWN', message: 'Austauschphase (Award/DP) nicht erkannt', severity: 'warnung' })
  }

  // Award/BoQ-Grundstruktur
  const award = getNested(gaeb, 'Award')
  if (!award) {
    errors.push({ code: 'AWARD_MISSING', message: '<Award>-Element fehlt', severity: 'fehler' })
  } else {
    const boq = getNested(award, 'BoQ')
    if (!boq) {
      errors.push({ code: 'BOQ_MISSING', message: '<BoQ> (Leistungsverzeichnis) fehlt', severity: 'fehler' })
    } else if (!getNested(boq, 'BoQBody')) {
      warnings.push({ code: 'BOQ_BODY_EMPTY', message: '<BoQBody> fehlt oder ist leer', severity: 'warnung' })
    }
  }

  return {
    valid: errors.length === 0,
    detectedVersion,
    detectedPhase,
    errors,
    warnings,
    checkedAt,
  }
}
