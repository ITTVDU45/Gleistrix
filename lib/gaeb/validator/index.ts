import { parseSecureXml } from '@/lib/gaeb/xml/secureXml'
import { validateGaebStructure } from '@/lib/gaeb/validator/structuralValidator'
import { validateAgainstXsd } from '@/lib/gaeb/validator/xsdValidator'
import { getPhaseDefinition } from '@/lib/gaeb/registry'
import type { GaebValidationResult } from '@/types/gaeb'

export interface GaebValidateOptions {
  /** XSD-Prüfung versuchen (falls libxmljs2 + Schema vorhanden). */
  strictXsd?: boolean
}

export interface GaebValidateResult {
  validation: GaebValidationResult
  /** Geparster XML-Baum (für nachgelagertes Parsing wiederverwendbar). */
  parsed?: unknown
  xsdUsed: boolean
}

/**
 * Zweistufige GAEB-Validierung:
 * 1) Sicheres Parsen (XXE-sicher) + strukturelle Prüfung (immer).
 * 2) Optionale XSD-Validierung gegen offizielle Schemata (falls verfügbar).
 */
export async function validateGaeb(
  rawXml: string,
  options: GaebValidateOptions = {}
): Promise<GaebValidateResult> {
  const secure = parseSecureXml(rawXml)
  if (!secure.ok) {
    return {
      validation: {
        valid: false,
        errors: [{ code: 'XML_PARSE', message: secure.error || 'XML-Fehler', severity: 'fehler' }],
        warnings: [],
        checkedAt: new Date().toISOString(),
      },
      xsdUsed: false,
    }
  }

  const structural = validateGaebStructure(secure.data)

  let xsdUsed = false
  if (options.strictXsd && structural.detectedVersion && structural.detectedPhase) {
    const phaseDef = getPhaseDefinition(structural.detectedVersion, structural.detectedPhase)
    const outcome = await validateAgainstXsd(rawXml, phaseDef?.xsdPath)
    if (outcome.available) {
      xsdUsed = true
      structural.errors.push(...(outcome.errors ?? []))
      structural.valid = structural.valid && (outcome.errors?.length ?? 0) === 0
    } else if (outcome.reason) {
      structural.warnings.push({ code: 'XSD_UNAVAILABLE', message: outcome.reason, severity: 'info' })
    }
  }

  return { validation: structural, parsed: secure.data, xsdUsed }
}
