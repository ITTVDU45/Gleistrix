/**
 * Typen für „Statistiken & Reports".
 *
 * Die Report-Oberfläche ist tab-basiert und datengetrieben: Jeder Tab liefert
 * ein `ReportSectionData`-Objekt (KPIs, Charts, Kategorien, Metriken), das von
 * generischen, wiederverwendbaren Komponenten gerendert wird. Neue Tabs lassen
 * sich über die `REPORT_TABS`-Registry und eine Mock-/API-Funktion ergänzen.
 */

export type ReportTabId =
  | 'allgemein'
  | 'projekte'
  | 'mitarbeiter'
  | 'auftraggeber'
  | 'fahrzeuge'
  | 'lager'
  | 'abrechnung'
  | 'einsaetze'
  | 'dokumente'
  | 'qualitaet'

export type ReportTone = 'default' | 'positive' | 'warning' | 'critical' | 'info'
export type ReportTrend = 'up' | 'down' | 'flat'
export type ReportChartType = 'bar' | 'line' | 'donut' | 'stacked'

export interface ReportKpiCard {
  id: string
  label: string
  value: number | string
  unit?: string
  sub?: string
  trend?: ReportTrend
  trendValue?: string
  tone?: ReportTone
  /** lucide-Icon-Name (wird im UI aufgelöst) */
  icon?: string
}

export interface ReportMetric {
  id: string
  label: string
  value: number
  /** Bezugsgröße für Fortschritts-/Anteilsdarstellung */
  total?: number
  unit?: string
  tone?: ReportTone
}

export interface ReportChartPoint {
  label: string
  value: number
  tone?: ReportTone
}

export interface ReportChartData {
  id: string
  title: string
  type: ReportChartType
  points: ReportChartPoint[]
  unit?: string
}

export interface ReportCategory {
  id: string
  label: string
  value: number
  tone?: ReportTone
}

export interface ReportFilter {
  /** ISO-Datum */
  from?: string
  to?: string
  status?: string
  category?: string
  search?: string
}

export interface ReportTab {
  id: ReportTabId
  label: string
  description?: string
  /** lucide-Icon-Name */
  icon?: string
}

/**
 * Standard-Datencontainer eines Report-Tabs. Wird von `ReportSection`
 * generisch gerendert – so bleibt jeder Tab schlank und erweiterbar.
 */
export interface ReportSectionData {
  kpis: ReportKpiCard[]
  charts?: ReportChartData[]
  categories?: ReportCategory[]
  metrics?: ReportMetric[]
  /** Freitext-Hinweise, z.B. offene Punkte / Empfehlungen */
  hinweise?: string[]
}

export type ReportOverview = Record<ReportTabId, ReportSectionData>
