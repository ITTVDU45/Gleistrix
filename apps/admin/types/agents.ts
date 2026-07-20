/**
 * Typen für das Agenten-Modul (KI-gestützte / regelbasierte Agenten).
 *
 * Bewusst backend-agnostisch gehalten: Die Mock-Daten in `lib/mock/agents.ts`
 * erfüllen exakt diese Interfaces und können 1:1 durch API-Daten ersetzt werden.
 */

export type AgentStatus = 'aktiv' | 'inaktiv' | 'wartung' | 'fehler' | 'entwurf'

export type AgentCategory =
  | 'lager'
  | 'ausschreibung'
  | 'projekt'
  | 'qualitaet'
  | 'personal'
  | 'einsatz'
  | 'fahrzeuge'
  | 'abrechnung'
  | 'dokumente'
  | 'kunde'
  | 'kommunikation'
  | 'analyse'
  | 'sicherheit'
  | 'allgemein'

export type AgentActionType =
  | 'pruefen'
  | 'melden'
  | 'zuweisen'
  | 'ignorieren'
  | 'exportieren'
  | 'analysieren'
  | 'importieren'

export type AgentActivityLevel = 'info' | 'warnung' | 'fehler' | 'erfolg'

export interface AgentAction {
  id: string
  label: string
  type: AgentActionType
  description?: string
  disabled?: boolean
}

export interface AgentActivity {
  id: string
  /** ISO-Zeitstempel */
  timestamp: string
  message: string
  level: AgentActivityLevel
}

export type MetricTone = 'default' | 'positive' | 'warning' | 'critical' | 'info'

export interface AgentMetric {
  id: string
  label: string
  value: number | string
  unit?: string
  tone?: MetricTone
}

export interface Agent {
  id: string
  /** Routen-Segment, z.B. 'mangel' oder 'lv' → /agenten/<slug> */
  slug: string
  name: string
  description: string
  category: AgentCategory
  status: AgentStatus
  /** lucide-Icon-Name (wird im UI aufgelöst) */
  icon?: string
  /** ISO-Zeitstempel der letzten Aktivität */
  lastActivityAt?: string
  metrics?: AgentMetric[]
  actions?: AgentAction[]
  activities?: AgentActivity[]
  /** „Nutzen im System" – Aufzählung der Fähigkeiten (für Platzhalter-Ansicht) */
  nutzen?: string[]
  /** „Mehrwert" – Nutzenversprechen */
  mehrwert?: string
  /** Beispiel-Anfragen / Use-Cases */
  beispiele?: string[]
}

// ---------------------------------------------------------------------------
// Mängel-Agent (Lagerverwaltung)
// ---------------------------------------------------------------------------

export type MangelSeverity = 'niedrig' | 'mittel' | 'hoch' | 'kritisch'
export type MangelStatus = 'offen' | 'in_pruefung' | 'behoben' | 'ignoriert'
export type MangelKategorie =
  | 'material_beschaedigt'
  | 'bestand_fehlt'
  | 'fehlerhafte_ausgabe'
  | 'fehlerhafte_ruecknahme'
  | 'wartung_faellig'
  | 'sonstiges'

export interface MangelItem {
  id: string
  titel: string
  beschreibung: string
  kategorie: MangelKategorie
  severity: MangelSeverity
  status: MangelStatus
  /** Artikel-/Referenzbezeichnung im Lager */
  artikel?: string
  artikelnummer?: string
  /** ISO-Zeitstempel */
  erkanntAm: string
  empfohleneAktion?: string
}

// ---------------------------------------------------------------------------
// LV-Agent (Leistungsverzeichnisse / Ausschreibungen)
// ---------------------------------------------------------------------------

export type LvDocumentStatus = 'importiert' | 'in_analyse' | 'fehler' | 'abgeschlossen'
export type LvRiskLevel = 'niedrig' | 'mittel' | 'hoch'

export interface LvDocument {
  id: string
  name: string
  /** ISO-Zeitstempel */
  hochgeladenAm: string
  status: LvDocumentStatus
  /** Anzahl erkannter Positionen */
  positionen: number
}

export interface LvPosition {
  id: string
  /** Ordnungszahl / Positionsnummer */
  position: string
  bezeichnung: string
  menge: number
  einheit: string
  einheitspreis?: number
  anforderung?: string
  /** ISO-Datum */
  frist?: string
}

export interface LvRisk {
  id: string
  titel: string
  hinweis: string
  level: LvRiskLevel
}

export interface LvNextStep {
  id: string
  titel: string
  beschreibung: string
  erledigt?: boolean
}
