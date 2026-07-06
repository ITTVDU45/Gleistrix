/**
 * Mock-Daten für „Statistiken & Reports".
 *
 * Jeder Tab liefert ein `ReportSectionData`. Neue Tabs: Eintrag in REPORT_TABS
 * ergänzen und Datensatz in MOCK_REPORT_OVERVIEW hinzufügen – die UI rendert
 * automatisch. Später ersetzbar durch `ReportsApi` (lib/api/reports.ts).
 */

import type { ReportTab, ReportSectionData, ReportOverview } from '@/types/reports'

/** Registry aller Report-Tabs – zentrale, erweiterbare Quelle für die UI. */
export const REPORT_TABS: ReportTab[] = [
  { id: 'allgemein', label: 'Allgemein', icon: 'LayoutDashboard', description: 'Zentrale KPIs im Überblick' },
  { id: 'projekte', label: 'Projekte', icon: 'Building2' },
  { id: 'mitarbeiter', label: 'Mitarbeiter', icon: 'Users' },
  { id: 'auftraggeber', label: 'Auftraggeber', icon: 'Briefcase' },
  { id: 'fahrzeuge', label: 'Fahrzeuge', icon: 'Truck' },
  { id: 'lager', label: 'Lager', icon: 'Package' },
  { id: 'abrechnung', label: 'Abrechnung', icon: 'Receipt' },
  { id: 'einsaetze', label: 'Einsätze', icon: 'CalendarRange' },
  { id: 'dokumente', label: 'Dokumente', icon: 'FileText' },
  { id: 'qualitaet', label: 'Qualität & Mängel', icon: 'ShieldAlert' },
]

export const MOCK_REPORT_OVERVIEW: ReportOverview = {
  allgemein: {
    kpis: [
      { id: 'proj', label: 'Aktive Projekte', value: 14, tone: 'info', icon: 'Building2', trend: 'up', trendValue: '+2' },
      { id: 'eins', label: 'Offene Einsätze', value: 9, tone: 'default', icon: 'CalendarRange' },
      { id: 'ma', label: 'Verfügbare Mitarbeiter', value: 21, tone: 'positive', icon: 'Users' },
      { id: 'abr', label: 'Offene Abrechnungen', value: 6, tone: 'warning', icon: 'Receipt' },
      { id: 'lager', label: 'Lagerwarnungen', value: 4, tone: 'warning', icon: 'Package' },
      { id: 'maengel', label: 'Aktuelle Mängel', value: 7, tone: 'critical', icon: 'ShieldAlert' },
      { id: 'docs', label: 'Dokumente in Prüfung', value: 5, tone: 'info', icon: 'FileText' },
    ],
    charts: [
      {
        id: 'weekly', title: 'Einsätze pro Woche', type: 'bar', unit: 'Einsätze',
        points: [
          { label: 'KW 25', value: 18 }, { label: 'KW 26', value: 22 },
          { label: 'KW 27', value: 20 }, { label: 'KW 28', value: 26 },
        ],
      },
    ],
    hinweise: ['1 kritischer Mangel erfordert sofortige Aufmerksamkeit.'],
  },
  projekte: {
    kpis: [
      { id: 'gesamt', label: 'Projekte gesamt', value: 32, icon: 'Building2' },
      { id: 'aktiv', label: 'Aktiv', value: 14, tone: 'positive' },
      { id: 'offene_aufgaben', label: 'Offene Aufgaben', value: 27, tone: 'warning' },
      { id: 'fehlende_docs', label: 'Fehlende Dokumente', value: 8, tone: 'critical' },
      { id: 'abr_bedarf', label: 'Abrechnungsbedarf', value: 6, tone: 'info' },
    ],
    charts: [
      {
        id: 'status', title: 'Projekte nach Status', type: 'bar',
        points: [
          { label: 'Aktiv', value: 14, tone: 'positive' },
          { label: 'Abgeschlossen', value: 9, tone: 'info' },
          { label: 'Fertiggestellt', value: 5, tone: 'default' },
          { label: 'Geleistet', value: 3, tone: 'default' },
          { label: 'Nicht gestartet', value: 1, tone: 'warning' },
        ],
      },
    ],
    metrics: [
      { id: 'fortschritt', label: 'Durchschn. Projektfortschritt', value: 68, total: 100, unit: '%', tone: 'positive' },
    ],
  },
  mitarbeiter: {
    kpis: [
      { id: 'gesamt', label: 'Mitarbeiter gesamt', value: 28, icon: 'Users' },
      { id: 'verfuegbar', label: 'Verfügbar', value: 21, tone: 'positive' },
      { id: 'abwesend', label: 'Abwesend', value: 4, tone: 'warning' },
      { id: 'quali_ablauf', label: 'Qualifikationen laufen ab', value: 3, tone: 'critical' },
    ],
    charts: [
      {
        id: 'auslastung', title: 'Einsätze pro Mitarbeiter (Top 5)', type: 'bar', unit: 'Einsätze',
        points: [
          { label: 'M. Kaya', value: 12 }, { label: 'A. Roth', value: 10 },
          { label: 'S. Vogel', value: 9 }, { label: 'T. Berger', value: 8 }, { label: 'L. Frank', value: 7 },
        ],
      },
    ],
    metrics: [
      { id: 'auslastung', label: 'Durchschn. Auslastung', value: 74, total: 100, unit: '%', tone: 'info' },
    ],
  },
  auftraggeber: {
    kpis: [
      { id: 'gesamt', label: 'Auftraggeber', value: 11, icon: 'Briefcase' },
      { id: 'laufend', label: 'Laufende Projekte', value: 14, tone: 'positive' },
      { id: 'angebote', label: 'Offene Angebote', value: 5, tone: 'info' },
      { id: 'volumen', label: 'Abrechnungsvolumen', value: '284.500', unit: '€', tone: 'default' },
    ],
    charts: [
      {
        id: 'proj_pro_ag', title: 'Projekte pro Auftraggeber (Top 5)', type: 'bar',
        points: [
          { label: 'DB Netz', value: 6 }, { label: 'Stadt MH', value: 4 },
          { label: 'Straßen.NRW', value: 3 }, { label: 'RWE', value: 2 }, { label: 'Sonstige', value: 5 },
        ],
      },
    ],
  },
  fahrzeuge: {
    kpis: [
      { id: 'gesamt', label: 'Fahrzeuge gesamt', value: 12, icon: 'Truck' },
      { id: 'verfuegbar', label: 'Verfügbar', value: 8, tone: 'positive' },
      { id: 'wartung', label: 'In Wartung', value: 2, tone: 'warning' },
      { id: 'pruefung', label: 'Nächste Prüfungen', value: 3, tone: 'info' },
      { id: 'maengel', label: 'Mängel/Ausfälle', value: 1, tone: 'critical' },
    ],
    charts: [
      {
        id: 'einsatzzeit', title: 'Einsatzstunden pro Fahrzeug (Top 5)', type: 'bar', unit: 'h',
        points: [
          { label: 'MH-GT 101', value: 142 }, { label: 'MH-GT 205', value: 128 },
          { label: 'MH-GT 310', value: 96 }, { label: 'MH-GT 044', value: 74 }, { label: 'MH-GT 512', value: 61 },
        ],
      },
    ],
  },
  lager: {
    kpis: [
      { id: 'niedrig', label: 'Niedrige Bestände', value: 4, tone: 'warning', icon: 'Package' },
      { id: 'ausgegeben', label: 'Ausgegebene Artikel', value: 138, tone: 'default' },
      { id: 'rueckgaben', label: 'Rückgaben (30 T.)', value: 42, tone: 'info' },
      { id: 'beschaedigt', label: 'Beschädigt/Fehlend', value: 7, tone: 'critical' },
    ],
    charts: [
      {
        id: 'bewegungen', title: 'Materialbewegungen pro Woche', type: 'bar',
        points: [
          { label: 'KW 25', value: 54 }, { label: 'KW 26', value: 61 },
          { label: 'KW 27', value: 48 }, { label: 'KW 28', value: 70 },
        ],
      },
    ],
    categories: [
      { id: 'ein', label: 'Eingänge', value: 96, tone: 'positive' },
      { id: 'aus', label: 'Ausgänge', value: 138, tone: 'info' },
      { id: 'ret', label: 'Rückgaben', value: 42, tone: 'default' },
    ],
  },
  abrechnung: {
    kpis: [
      { id: 'offen', label: 'Offene Abrechnungen', value: 6, tone: 'warning', icon: 'Receipt' },
      { id: 'geprueft', label: 'Geprüft', value: 9, tone: 'positive' },
      { id: 'abgerechnet', label: 'Abgerechnete Projekte', value: 17, tone: 'info' },
      { id: 'klaerung', label: 'Klärungsbedarf', value: 3, tone: 'critical' },
    ],
    charts: [
      {
        id: 'monatlich', title: 'Abrechnungsvolumen pro Monat', type: 'bar', unit: '€',
        points: [
          { label: 'Apr', value: 62000 }, { label: 'Mai', value: 74500 },
          { label: 'Jun', value: 68900 }, { label: 'Jul', value: 79100 },
        ],
      },
    ],
  },
  einsaetze: {
    kpis: [
      { id: 'geplant', label: 'Geplante Einsätze', value: 23, tone: 'info', icon: 'CalendarRange' },
      { id: 'abgeschlossen', label: 'Abgeschlossen', value: 41, tone: 'positive' },
      { id: 'rueckmeldung', label: 'Offene Rückmeldungen', value: 5, tone: 'warning' },
      { id: 'konflikte', label: 'Konflikte/Überbuchungen', value: 2, tone: 'critical' },
    ],
    charts: [
      {
        id: 'schichten', title: 'Einsätze nach Schicht', type: 'bar',
        points: [
          { label: 'Frühschicht', value: 34, tone: 'positive' },
          { label: 'Nachtschicht', value: 12, tone: 'critical' },
        ],
      },
    ],
    metrics: [
      { id: 'stunden', label: 'Geleistete Einsatzstunden', value: 1284, unit: 'h', tone: 'default' },
    ],
  },
  dokumente: {
    kpis: [
      { id: 'hochgeladen', label: 'Hochgeladene Dokumente', value: 312, icon: 'FileText' },
      { id: 'pruefung', label: 'In Prüfung', value: 5, tone: 'info' },
      { id: 'fehlend', label: 'Fehlende Dokumente', value: 8, tone: 'warning' },
      { id: 'ablaufend', label: 'Ablaufende Nachweise', value: 3, tone: 'critical' },
    ],
    charts: [
      {
        id: 'typen', title: 'Dokumente nach Typ', type: 'bar',
        points: [
          { label: 'Nachweise', value: 84 }, { label: 'Pläne', value: 63 },
          { label: 'Fotos', value: 121 }, { label: 'Sonstige', value: 44 },
        ],
      },
    ],
  },
  qualitaet: {
    kpis: [
      { id: 'offen', label: 'Offene Mängel', value: 7, tone: 'warning', icon: 'ShieldAlert' },
      { id: 'behoben', label: 'Behoben (30 T.)', value: 12, tone: 'positive' },
      { id: 'kritisch', label: 'Kritisch', value: 1, tone: 'critical' },
      { id: 'bearbeitung', label: 'Ø Bearbeitungszeit', value: 2.4, unit: 'Tage', tone: 'info' },
    ],
    charts: [
      {
        id: 'kategorie', title: 'Mängel nach Kategorie', type: 'bar',
        points: [
          { label: 'Material', value: 5, tone: 'warning' },
          { label: 'Bestand', value: 4, tone: 'info' },
          { label: 'Ausgabe/Rückgabe', value: 3, tone: 'default' },
          { label: 'Wartung', value: 2, tone: 'critical' },
        ],
      },
    ],
    categories: [
      { id: 'lager', label: 'Lager', value: 9, tone: 'warning' },
      { id: 'fahrzeug', label: 'Fahrzeuge', value: 3, tone: 'info' },
      { id: 'projekt', label: 'Projekte', value: 2, tone: 'default' },
    ],
  },
}

export function getMockReportSection(tabId: keyof ReportOverview): ReportSectionData {
  return MOCK_REPORT_OVERVIEW[tabId]
}
