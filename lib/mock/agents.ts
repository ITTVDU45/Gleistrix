/**
 * Mock-Daten für das Agenten-Modul.
 *
 * Struktur entspricht exakt den Typen in `types/agents.ts` und ist so aufgebaut,
 * dass sie später ohne UI-Änderungen durch echte API-Antworten ersetzt werden
 * kann (siehe `lib/api/agents.ts`).
 */

import type {
  Agent,
  MangelItem,
  LvDocument,
  LvPosition,
  LvRisk,
  LvNextStep,
} from '@/types/agents'

function isoDaysAgo(days: number, hour = 9): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  d.setHours(hour, 0, 0, 0)
  return d.toISOString()
}

export const MOCK_AGENTS: Agent[] = [
  {
    id: 'agent-mangel',
    slug: 'mangel',
    name: 'Mängel Agent',
    description:
      'Erkennt, dokumentiert und verfolgt Mängel in der Lagerverwaltung – beschädigtes Material, fehlende Bestände und fehlerhafte Ausgaben/Rückgaben.',
    category: 'lager',
    status: 'aktiv',
    icon: 'PackageSearch',
    lastActivityAt: isoDaysAgo(0, 8),
    metrics: [
      { id: 'offen', label: 'Offene Mängel', value: 7, tone: 'warning' },
      { id: 'pruefung', label: 'Offene Prüfungen', value: 3, tone: 'info' },
      { id: 'kritisch', label: 'Kritisch', value: 1, tone: 'critical' },
      { id: 'behoben', label: 'Behoben (30 T.)', value: 12, tone: 'positive' },
    ],
    actions: [
      { id: 'scan', label: 'Bestand prüfen', type: 'pruefen', description: 'Vollständige Bestandsprüfung anstoßen' },
      { id: 'report', label: 'Mängelbericht exportieren', type: 'exportieren' },
      { id: 'assign', label: 'Prüfung zuweisen', type: 'zuweisen' },
    ],
    activities: [
      { id: 'a1', timestamp: isoDaysAgo(0, 8), message: 'Neuer Mangel erkannt: Absperrgitter beschädigt', level: 'warnung' },
      { id: 'a2', timestamp: isoDaysAgo(1, 16), message: 'Bestandsdifferenz bei Warnleuchten dokumentiert', level: 'info' },
      { id: 'a3', timestamp: isoDaysAgo(2, 11), message: '3 Mängel als behoben markiert', level: 'erfolg' },
    ],
  },
  {
    id: 'agent-lv',
    slug: 'lv',
    name: 'LV Agent',
    description:
      'Analysiert Leistungsverzeichnisse und Ausschreibungen, extrahiert Positionen, Mengen, Anforderungen und Fristen für die Angebotsvorbereitung.',
    category: 'ausschreibung',
    status: 'entwurf',
    icon: 'FileSpreadsheet',
    lastActivityAt: isoDaysAgo(4, 14),
    metrics: [
      { id: 'dokumente', label: 'Importierte LVs', value: 2, tone: 'info' },
      { id: 'positionen', label: 'Erkannte Positionen', value: 48, tone: 'default' },
      { id: 'risiken', label: 'Risiken/Hinweise', value: 4, tone: 'warning' },
    ],
    actions: [
      { id: 'import', label: 'LV importieren', type: 'importieren', description: 'PDF/GAEB-Dokument hochladen' },
      { id: 'analyze', label: 'Analyse starten', type: 'analysieren' },
      { id: 'export', label: 'Positionen exportieren', type: 'exportieren' },
    ],
    activities: [
      { id: 'l1', timestamp: isoDaysAgo(4, 14), message: 'LV „BAB A40 – Absicherung" analysiert (30 Positionen)', level: 'info' },
      { id: 'l2', timestamp: isoDaysAgo(6, 10), message: 'Frist-Hinweis erkannt: Angebotsabgabe in 12 Tagen', level: 'warnung' },
    ],
  },
]

export function getMockAgentBySlug(slug: string): Agent | undefined {
  return MOCK_AGENTS.find((a) => a.slug === slug || a.id === slug)
}

// ---------------------------------------------------------------------------
// Mängel-Agent Detaildaten
// ---------------------------------------------------------------------------

export const MOCK_MANGEL_ITEMS: MangelItem[] = [
  {
    id: 'm1',
    titel: 'Absperrgitter beschädigt',
    beschreibung: 'Zwei Absperrgitter mit verbogenen Standfüßen aus Projekt Rückgabe.',
    kategorie: 'material_beschaedigt',
    severity: 'mittel',
    status: 'offen',
    artikel: 'Absperrgitter Typ A',
    artikelnummer: '004',
    erkanntAm: isoDaysAgo(0, 8),
    empfohleneAktion: 'Reparatur oder Aussonderung prüfen',
  },
  {
    id: 'm2',
    titel: 'Bestandsdifferenz Warnleuchten',
    beschreibung: 'Systembestand 24, gezählt 19 – Differenz von 5 Stück.',
    kategorie: 'bestand_fehlt',
    severity: 'hoch',
    status: 'in_pruefung',
    artikel: 'LED-Warnleuchte',
    artikelnummer: '012',
    erkanntAm: isoDaysAgo(1, 16),
    empfohleneAktion: 'Inventur-Nachzählung durchführen',
  },
  {
    id: 'm3',
    titel: 'Fehlerhafte Ausgabe Schutzkleidung',
    beschreibung: 'Ausgabe ohne Empfängerzuordnung gebucht.',
    kategorie: 'fehlerhafte_ausgabe',
    severity: 'niedrig',
    status: 'offen',
    artikel: 'Warnschutzjacke',
    artikelnummer: '021',
    erkanntAm: isoDaysAgo(2, 9),
    empfohleneAktion: 'Empfänger nachtragen',
  },
  {
    id: 'm4',
    titel: 'Gasprüfgerät überfällig',
    beschreibung: 'Wartung/Prüfung seit 8 Tagen überfällig.',
    kategorie: 'wartung_faellig',
    severity: 'kritisch',
    status: 'offen',
    artikel: 'Gasmessgerät X-am',
    artikelnummer: '033',
    erkanntAm: isoDaysAgo(3, 12),
    empfohleneAktion: 'Sofort aus Verkehr ziehen und prüfen lassen',
  },
]

// ---------------------------------------------------------------------------
// LV-Agent Detaildaten
// ---------------------------------------------------------------------------

export const MOCK_LV_DOCUMENTS: LvDocument[] = [
  { id: 'lv1', name: 'BAB A40 – Absicherung.pdf', hochgeladenAm: isoDaysAgo(4, 14), status: 'abgeschlossen', positionen: 30 },
  { id: 'lv2', name: 'Bahnhof West – Gleisbau LV.gaeb', hochgeladenAm: isoDaysAgo(2, 10), status: 'in_analyse', positionen: 18 },
]

export const MOCK_LV_POSITIONS: LvPosition[] = [
  { id: 'p1', position: '01.01.0010', bezeichnung: 'Verkehrssicherung einrichten', menge: 1, einheit: 'psch', einheitspreis: 2400, anforderung: 'RSA 21 konform', frist: isoDaysAgo(-12, 12).slice(0, 10) },
  { id: 'p2', position: '01.01.0020', bezeichnung: 'Absperrschranken vorhalten', menge: 250, einheit: 'm', einheitspreis: 3.5, anforderung: 'Reflektierend, Klasse RA2' },
  { id: 'p3', position: '01.02.0010', bezeichnung: 'Verkehrszeichen aufstellen', menge: 40, einheit: 'St', einheitspreis: 18, anforderung: 'StVO-konform' },
  { id: 'p4', position: '02.01.0010', bezeichnung: 'Nachtschicht-Zuschlag Absicherung', menge: 12, einheit: 'h', anforderung: 'Nachweis Personalqualifikation' },
]

export const MOCK_LV_RISKS: LvRisk[] = [
  { id: 'r1', titel: 'Enge Angebotsfrist', hinweis: 'Angebotsabgabe in 12 Tagen – knappe Kalkulationszeit.', level: 'hoch' },
  { id: 'r2', titel: 'Personalqualifikation', hinweis: 'Nachtschichten erfordern zertifiziertes Personal.', level: 'mittel' },
  { id: 'r3', titel: 'Pauschalposition', hinweis: 'Position 01.01.0010 als Pauschale – Aufwand genau prüfen.', level: 'mittel' },
  { id: 'r4', titel: 'Unklare Mengenangabe', hinweis: 'Menge bei Nachtschicht-Zuschlag ggf. zu niedrig angesetzt.', level: 'niedrig' },
]

export const MOCK_LV_NEXT_STEPS: LvNextStep[] = [
  { id: 'n1', titel: 'Kalkulation starten', beschreibung: 'Einheitspreise für offene Positionen ergänzen.' },
  { id: 'n2', titel: 'Personalverfügbarkeit prüfen', beschreibung: 'Zertifiziertes Nachtschicht-Personal einplanen.' },
  { id: 'n3', titel: 'Rückfrage an Auftraggeber', beschreibung: 'Mengenangabe Position 02.01.0010 klären.' },
]
