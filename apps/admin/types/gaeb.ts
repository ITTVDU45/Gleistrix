/**
 * Zentrale Typen für die GAEB-Integration.
 *
 * Grundprinzip: GAEB-Versionen und Austauschphasen werden NICHT hart kodiert,
 * sondern über eine konfigurierbare Registry (`lib/gaeb/registry.ts`) und die
 * gespeicherten `GaebIntegrationSettings` gesteuert. Die Semantik der Phasen
 * ist version-/quellenabhängig und daher als Daten (Label/Direction/hasPrices)
 * hinterlegt und gegen offizielle XSD-Schemata prüfbar.
 *
 * Einsatz: Ein-Unternehmen-Instanz → Konfiguration standardmäßig global
 * (`scope: 'global'`), Struktur bleibt aber mandantenfähig.
 */

export type GaebFormat = 'gaeb-da-xml' | 'gaeb-90' | 'gaeb-2000'

/** Versionskennung, erweiterbar (string erlaubt zukünftige Versionen). */
export type GaebVersionId = '3.2' | '3.3' | (string & {})

/** Austauschphase, erweiterbar. */
export type GaebExchangePhaseCode =
  | 'X81'
  | 'X82'
  | 'X83'
  | 'X84'
  | 'X85'
  | 'X86'
  | 'X87'
  | 'X89'
  | (string & {})

export type GaebPhaseDirection = 'import' | 'export' | 'both'

export type GaebImportStatus =
  | 'hochgeladen'
  | 'validierung'
  | 'validiert'
  | 'geparst'
  | 'zugeordnet'
  | 'fehler'

export type GaebSeverity = 'info' | 'warnung' | 'fehler'

export type GaebPositionType = 'normal' | 'zuschlag' | 'bedarf' | 'alternativ' | 'grundtext'

// ---------------------------------------------------------------------------
// Registry / Konfiguration
// ---------------------------------------------------------------------------

/** Versionierbare Phasen-Definition – keine hartkodierte Bedeutung. */
export interface GaebExchangePhase {
  code: GaebExchangePhaseCode
  /** Anzeige-/Fachbezeichnung, je Version konfigurierbar */
  label: string
  direction: GaebPhaseDirection
  /** Enthält Preise (z.B. X84/X89) – steuert erwartete Felder */
  hasPrices: boolean
  /** Pfad zum offiziellen XSD-Schema (relativ zu lib/gaeb/xsd) */
  xsdPath?: string
  enabled: boolean
}

export interface GaebVersion {
  id: GaebVersionId
  format: GaebFormat
  label: string
  phases: GaebExchangePhase[]
  enabled: boolean
}

export interface GaebIntegrationSettings {
  enabled: boolean
  /** Ein-Unternehmen-Instanz: standardmäßig 'global' */
  scope: 'global' | 'mandant'
  mandantId?: string
  allowedVersions: GaebVersionId[]
  allowedPhases: GaebExchangePhaseCode[]
  maxFileSizeBytes: number
  strictXsdValidation: boolean
}

// ---------------------------------------------------------------------------
// Datei / Import / Validierung
// ---------------------------------------------------------------------------

export interface GaebFile {
  _id: string
  originalName: string
  /** MinIO Object-Key */
  storageKey: string
  sizeBytes: number
  mimeType: string
  /** SHA-256 zur Idempotenz-/Dublettenerkennung */
  sha256: string
  uploadedByUserId: string
  /** ISO-Zeitstempel */
  uploadedAt: string
}

export interface GaebValidationError {
  code: string
  message: string
  severity: GaebSeverity
  line?: number
  column?: number
  xpath?: string
}

export interface GaebValidationResult {
  valid: boolean
  detectedVersion?: GaebVersionId
  detectedPhase?: GaebExchangePhaseCode
  errors: GaebValidationError[]
  warnings: GaebValidationError[]
  /** ISO-Zeitstempel */
  checkedAt: string
}

// ---------------------------------------------------------------------------
// Leistungsverzeichnis (Bill of Quantities)
// ---------------------------------------------------------------------------

export interface GaebPriceInfo {
  /** Einheitspreis (UP) */
  unitPrice?: number
  /** Gesamtbetrag (IT) */
  totalPrice?: number
  currency: string
  vatRate?: number
}

export interface GaebPosition {
  _id?: string
  boqId?: string
  /** Ordnungszahl (OZ) */
  ordinalNumber: string
  type: GaebPositionType
  shortText: string
  /** sanitisierter Langtext */
  longText?: string
  quantity?: number
  /** Einheit (QU) */
  unit?: string
  price?: GaebPriceInfo
  parentTitleId?: string
}

export interface GaebTitle {
  _id?: string
  label: string
  ordinalNumber?: string
  sum?: number
  positions: GaebPosition[]
}

export interface GaebLot {
  _id?: string
  label: string
  titles: GaebTitle[]
  sum?: number
}

export interface GaebBillOfQuantities {
  _id: string
  importJobId: string
  version: GaebVersionId
  phase: GaebExchangePhaseCode
  projectName?: string
  currency: string
  netSum?: number
  grossSum?: number
  lots: GaebLot[]
  positionCount: number
  /** ISO-Zeitstempel */
  createdAt: string
}

export interface GaebImportAssignment {
  projectId?: string
  auftraggeberId?: string
  ausschreibungId?: string
  angebotId?: string
}

export interface GaebImportJob {
  _id: string
  fileId: string
  status: GaebImportStatus
  version?: GaebVersionId
  phase?: GaebExchangePhaseCode
  validation?: GaebValidationResult
  boqId?: string
  assignment?: GaebImportAssignment
  createdByUserId: string
  /** ISO-Zeitstempel */
  createdAt: string
  updatedAt: string
  error?: string
}

// ---------------------------------------------------------------------------
// GAEB-Agent (spätere KI-Auswertung – Ausgabe-Vertrag)
// ---------------------------------------------------------------------------

export type GaebRiskLevel = 'niedrig' | 'mittel' | 'hoch'

export interface GaebAgentRisk {
  id: string
  title: string
  hint: string
  level: GaebRiskLevel
}

export interface GaebAgentCluster {
  id: string
  label: string
  positionCount: number
  gewerk?: string
}

export interface GaebAgentResourceSuggestion {
  type: 'mitarbeiter' | 'fahrzeug' | 'lagerartikel'
  label: string
  reason: string
}

export interface GaebAgentAnalysis {
  importJobId: string
  summary: string
  risks: GaebAgentRisk[]
  missingData: string[]
  clusters: GaebAgentCluster[]
  resourceSuggestions?: GaebAgentResourceSuggestion[]
  projectDraft?: { name: string; auftraggeber?: string; positionCount: number }
  /** ISO-Zeitstempel */
  generatedAt: string
}
