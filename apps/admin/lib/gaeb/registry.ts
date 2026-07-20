/**
 * Konfigurierbare GAEB-Registry.
 *
 * Versionen und Austauschphasen sind hier als DATEN definiert (nicht als
 * hartkodierte Logik). Die tatsächlich aktiven Versionen/Phasen ergeben sich
 * aus den gespeicherten `GaebIntegrationSettings` (überlagern die Defaults).
 * XSD-Pfade verweisen auf gebündelte offizielle Schemata unter `lib/gaeb/xsd/`.
 */

import type {
  GaebVersion,
  GaebExchangePhase,
  GaebIntegrationSettings,
  GaebVersionId,
} from '@/types/gaeb'

/**
 * Standard-Phasen für GAEB DA XML. Die Bedeutung/Labels sind bewusst als Daten
 * hinterlegt und können je Version/Instanz angepasst werden.
 */
const DA_XML_PHASES: GaebExchangePhase[] = [
  { code: 'X81', label: 'Leistungsverzeichnis (LV)', direction: 'import', hasPrices: false, xsdPath: 'da-xml/3.3/GAEB_DA_XML_3.3.xsd', enabled: true },
  { code: 'X82', label: 'Kostenanschlag', direction: 'import', hasPrices: true, xsdPath: 'da-xml/3.3/GAEB_DA_XML_3.3.xsd', enabled: false },
  { code: 'X83', label: 'Angebotsaufforderung', direction: 'import', hasPrices: false, xsdPath: 'da-xml/3.3/GAEB_DA_XML_3.3.xsd', enabled: true },
  { code: 'X84', label: 'Angebotsabgabe', direction: 'export', hasPrices: true, xsdPath: 'da-xml/3.3/GAEB_DA_XML_3.3.xsd', enabled: false },
  { code: 'X85', label: 'Nebenangebot', direction: 'both', hasPrices: true, xsdPath: 'da-xml/3.3/GAEB_DA_XML_3.3.xsd', enabled: false },
  { code: 'X86', label: 'Auftragserteilung', direction: 'both', hasPrices: true, xsdPath: 'da-xml/3.3/GAEB_DA_XML_3.3.xsd', enabled: false },
  { code: 'X87', label: 'Auftragsbestätigung', direction: 'both', hasPrices: true, xsdPath: 'da-xml/3.3/GAEB_DA_XML_3.3.xsd', enabled: false },
  { code: 'X89', label: 'Rechnung', direction: 'both', hasPrices: true, xsdPath: 'da-xml/3.3/GAEB_DA_XML_3.3.xsd', enabled: false },
]

/** Verfügbare GAEB-Versionen (erweiterbar). */
export const GAEB_VERSIONS: GaebVersion[] = [
  {
    id: '3.3',
    format: 'gaeb-da-xml',
    label: 'GAEB DA XML 3.3',
    phases: DA_XML_PHASES.map((p) => ({ ...p })),
    enabled: true,
  },
  {
    id: '3.2',
    format: 'gaeb-da-xml',
    label: 'GAEB DA XML 3.2',
    phases: DA_XML_PHASES.map((p) => ({ ...p, xsdPath: p.xsdPath?.replace('3.3', '3.2') })),
    enabled: true,
  },
]

/** Sinnvolle Default-Einstellungen (MVP: LV-Import X81 + Angebotsaufforderung X83). */
export const DEFAULT_GAEB_SETTINGS: GaebIntegrationSettings = {
  enabled: false,
  scope: 'global',
  allowedVersions: ['3.3', '3.2'],
  allowedPhases: ['X81', 'X83'],
  maxFileSizeBytes: 25 * 1024 * 1024,
  strictXsdValidation: true,
}

export function getGaebVersion(id: string): GaebVersion | undefined {
  return GAEB_VERSIONS.find((v) => v.id === id)
}

/** Alle bekannten Phasen-Codes (dedupliziert) über alle Versionen. */
export function listAllPhaseCodes(): string[] {
  const set = new Set<string>()
  for (const v of GAEB_VERSIONS) for (const p of v.phases) set.add(p.code)
  return Array.from(set)
}

export function getPhaseDefinition(
  versionId: GaebVersionId,
  code: string
): GaebExchangePhase | undefined {
  return getGaebVersion(versionId)?.phases.find((p) => p.code === code)
}

/**
 * Führt gespeicherte (Teil-)Settings mit den Defaults zusammen. Unbekannte
 * Versionen/Phasen werden gegen die Registry gefiltert.
 */
export function mergeGaebSettings(
  stored?: Partial<GaebIntegrationSettings> | null
): GaebIntegrationSettings {
  const known = new Set(GAEB_VERSIONS.map((v) => v.id))
  const knownPhases = new Set(listAllPhaseCodes())
  const s = stored ?? {}
  return {
    enabled: s.enabled ?? DEFAULT_GAEB_SETTINGS.enabled,
    scope: s.scope ?? DEFAULT_GAEB_SETTINGS.scope,
    mandantId: s.mandantId,
    allowedVersions: (s.allowedVersions ?? DEFAULT_GAEB_SETTINGS.allowedVersions).filter((v) =>
      known.has(v)
    ),
    allowedPhases: (s.allowedPhases ?? DEFAULT_GAEB_SETTINGS.allowedPhases).filter((p) =>
      knownPhases.has(p)
    ),
    maxFileSizeBytes: s.maxFileSizeBytes ?? DEFAULT_GAEB_SETTINGS.maxFileSizeBytes,
    strictXsdValidation: s.strictXsdValidation ?? DEFAULT_GAEB_SETTINGS.strictXsdValidation,
  }
}
