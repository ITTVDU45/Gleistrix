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
    id: 'agent-dokumentation',
    slug: 'dokumentation',
    name: 'Dokumentationsagent',
    description:
      'Unterstützt die automatische Erstellung und Pflege sämtlicher Projektdokumentationen aus Projekten, Einsätzen, Fotos, Mängeln, Dokumenten und Mitarbeiterberichten.',
    category: 'dokumente',
    status: 'entwurf',
    icon: 'ClipboardList',
    nutzen: [
      'Automatische Bautagesberichte',
      'Erstellung von Projektchronologien',
      'Zusammenfassung aller Aktivitäten eines Projekts',
      'Verknüpfung von Fotos mit Projekten',
      'Erkennung fehlender Dokumentationen',
      'Erstellung von Abschlussberichten',
      'Automatische Übergabedokumentationen',
    ],
    mehrwert:
      'Reduziert den Dokumentationsaufwand erheblich und sorgt für vollständige, nachvollziehbare Projektdokumentationen.',
  },
  {
    id: 'agent-projekt',
    slug: 'projekt',
    name: 'Projektagent',
    description:
      'Überwacht sämtliche Projekte und unterstützt Projektleiter bei Planung, Durchführung und Kontrolle.',
    category: 'projekt',
    status: 'entwurf',
    icon: 'FolderKanban',
    nutzen: [
      'Überwachung von Projektfristen',
      'Erkennung offener Aufgaben',
      'Analyse des Projektfortschritts',
      'Erinnerung an wichtige Termine',
      'Identifikation von Projektrisiken',
      'Automatische Statusberichte',
    ],
    mehrwert: 'Frühzeitige Erkennung von Problemen und bessere Projektsteuerung.',
  },
  {
    id: 'agent-lv',
    slug: 'lv',
    name: 'LV-Agent',
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
    nutzen: [
      'Analyse von Leistungsverzeichnissen',
      'Strukturierung von Positionen',
      'Mengenanalyse',
      'Erkennung wichtiger Anforderungen',
      'Identifikation von Nachträgen',
      'Vergleich verschiedener Leistungsverzeichnisse',
    ],
    mehrwert: 'Schnellere Angebotsbearbeitung und geringeres Fehlerrisiko.',
  },
  {
    id: 'agent-kalkulation',
    slug: 'kalkulation',
    name: 'Kalkulationsagent',
    description: 'Unterstützt bei der wirtschaftlichen Planung von Projekten und Angeboten.',
    category: 'abrechnung',
    status: 'entwurf',
    icon: 'Calculator',
    nutzen: [
      'Berechnung von Materialkosten',
      'Personalkosten kalkulieren',
      'Fahrzeugkosten berücksichtigen',
      'Deckungsbeiträge berechnen',
      'Wirtschaftlichkeitsprüfung',
      'Angebotskalkulation',
    ],
    mehrwert: 'Präzisere Kalkulationen und höhere Wirtschaftlichkeit.',
  },
  {
    id: 'agent-personal',
    slug: 'personal',
    name: 'Personalagent',
    description: 'Verwaltet Mitarbeiterdaten und unterstützt die Einsatzplanung.',
    category: 'personal',
    status: 'entwurf',
    icon: 'UserCog',
    nutzen: [
      'Überwachung von Qualifikationen',
      'Ablaufdaten von Zertifikaten prüfen',
      'Schulungen empfehlen',
      'Mitarbeiterverfügbarkeit analysieren',
      'Passende Mitarbeiter für Projekte vorschlagen',
    ],
    mehrwert: 'Optimale Personaleinsatzplanung und höhere Rechtssicherheit.',
  },
  {
    id: 'agent-einsatz',
    slug: 'einsatz',
    name: 'Einsatzagent',
    description: 'Plant Mitarbeitereinsätze intelligent und erkennt mögliche Konflikte.',
    category: 'einsatz',
    status: 'entwurf',
    icon: 'CalendarClock',
    nutzen: [
      'Optimale Schichtplanung',
      'Konflikterkennung',
      'Ruhezeiten überwachen',
      'Einsatzorte optimieren',
      'Vertretungsvorschläge',
      'Kapazitätsplanung',
    ],
    mehrwert: 'Effizientere Einsatzplanung und geringere Planungsfehler.',
  },
  {
    id: 'agent-lager',
    slug: 'lager',
    name: 'Lageragent',
    description: 'Überwacht sämtliche Lagerbestände und Materialbewegungen.',
    category: 'lager',
    status: 'entwurf',
    icon: 'Boxes',
    nutzen: [
      'Mindestbestände überwachen',
      'Materialverbrauch analysieren',
      'Bestellvorschläge erstellen',
      'Lagerbewegungen dokumentieren',
      'Inventur unterstützen',
      'Materialbedarf prognostizieren',
    ],
    mehrwert: 'Vermeidung von Materialengpässen und optimierte Lagerhaltung.',
  },
  {
    id: 'agent-mangel',
    slug: 'mangel',
    name: 'Mängelagent',
    description:
      'Erkennt, dokumentiert und analysiert Mängel an Material, Fahrzeugen oder Projekten – inklusive beschädigtem Material, fehlender Bestände und fehlerhafter Ausgaben/Rückgaben.',
    category: 'qualitaet',
    status: 'aktiv',
    icon: 'ShieldAlert',
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
    nutzen: [
      'Mängel erfassen',
      'Ursachen analysieren',
      'Wiederkehrende Schäden erkennen',
      'Prioritäten vergeben',
      'Reparaturen nachverfolgen',
      'Ersatzbeschaffung empfehlen',
    ],
    mehrwert: 'Schnellere Mängelbeseitigung und höhere Materialqualität.',
  },
  {
    id: 'agent-fahrzeug',
    slug: 'fahrzeug',
    name: 'Fahrzeugagent',
    description: 'Überwacht den kompletten Fahrzeugbestand.',
    category: 'fahrzeuge',
    status: 'entwurf',
    icon: 'Truck',
    nutzen: [
      'Wartungsplanung',
      'UVV-Überwachung',
      'TÜV-Fristen',
      'Kilometerauswertung',
      'Fahrzeugauslastung',
      'Schadenshistorie',
    ],
    mehrwert: 'Höhere Fahrzeugverfügbarkeit und geringere Ausfallzeiten.',
  },
  {
    id: 'agent-dokumente',
    slug: 'dokumente',
    name: 'Dokumentenagent',
    description: 'Organisiert und analysiert sämtliche Dokumente innerhalb von Gleistrix.',
    category: 'dokumente',
    status: 'entwurf',
    icon: 'Files',
    nutzen: [
      'Automatische Dokumentenzuordnung',
      'OCR-Texterkennung',
      'Versionierung',
      'Dublettenerkennung',
      'Dokumentensuche',
      'Vollständigkeitsprüfung',
    ],
    mehrwert: 'Schneller Zugriff auf Dokumente und weniger Verwaltungsaufwand.',
  },
  {
    id: 'agent-abrechnung',
    slug: 'abrechnung',
    name: 'Abrechnungsagent',
    description: 'Unterstützt die Vorbereitung und Kontrolle von Abrechnungen.',
    category: 'abrechnung',
    status: 'entwurf',
    icon: 'CreditCard',
    nutzen: [
      'Fehlende Stunden erkennen',
      'Leistungsnachweise prüfen',
      'Rechnungen vorbereiten',
      'Plausibilitätsprüfungen',
      'Nachtragskontrolle',
      'Abrechnungsstatus überwachen',
    ],
    mehrwert: 'Weniger Abrechnungsfehler und schnellere Rechnungsstellung.',
  },
  {
    id: 'agent-kunden',
    slug: 'kunden',
    name: 'Kundenagent',
    description: 'Verwaltet alle Informationen rund um Auftraggeber und Geschäftsbeziehungen.',
    category: 'kunde',
    status: 'entwurf',
    icon: 'Handshake',
    nutzen: [
      'Kundenhistorie anzeigen',
      'Projekte analysieren',
      'Angebotsstatus überwachen',
      'Kommunikation zusammenfassen',
      'Folgeaufträge erkennen',
      'Kundenauswertungen erstellen',
    ],
    mehrwert: 'Verbesserte Kundenbetreuung und höhere Transparenz.',
  },
  {
    id: 'agent-assistent',
    slug: 'assistent',
    name: 'Gleistrix Assistent',
    description:
      'Der zentrale KI-Agent des Systems. Intelligente Anlaufstelle für alle Nutzer, die Informationen aus sämtlichen Modulen zusammenführt.',
    category: 'allgemein',
    status: 'entwurf',
    icon: 'Sparkles',
    nutzen: [
      'Fragen in natürlicher Sprache beantworten',
      'Daten aus allen Modulen auswerten',
      'Handlungsempfehlungen geben',
      'Aufgaben delegieren',
      'Zusammenfassungen erstellen',
      'Informationen schnell auffinden',
    ],
    beispiele: [
      'Welche Projekte haben nächste Woche Fristen?',
      'Welche Mitarbeiter besitzen einen gültigen SIPO?',
      'Welche Fahrzeuge müssen diesen Monat zur UVV?',
      'Welche Dokumente fehlen im Projekt Dortmund?',
      'Zeige mir alle offenen Mängel im Lager.',
    ],
    mehrwert: 'Ein zentraler Ansprechpartner für alle Informationen und Prozesse in Gleistrix.',
  },
  {
    id: 'agent-qualitaet',
    slug: 'qualitaet',
    name: 'Qualitätsagent',
    description: 'Überwacht Qualitätsstandards und analysiert Mängel sowie Prüfprozesse.',
    category: 'qualitaet',
    status: 'entwurf',
    icon: 'BadgeCheck',
    nutzen: [
      'Qualitätskennzahlen berechnen',
      'Prüfprotokolle analysieren',
      'Fehlerursachen erkennen',
      'Wiederkehrende Mängel identifizieren',
      'Qualitätsberichte erstellen',
    ],
    mehrwert: 'Kontinuierliche Verbesserung der Arbeitsqualität.',
  },
  {
    id: 'agent-sicherheit',
    slug: 'sicherheit',
    name: 'Sicherheitsagent',
    description: 'Unterstützt die Einhaltung aller sicherheitsrelevanten Vorgaben im Bahnbereich.',
    category: 'sicherheit',
    status: 'entwurf',
    icon: 'HardHat',
    nutzen: [
      'Überwachung sicherheitsrelevanter Qualifikationen',
      'Ablaufdaten prüfen',
      'Gefährdungen dokumentieren',
      'Sicherheitsmaßnahmen kontrollieren',
      'Sicherheitsberichte erstellen',
      'Warnungen bei Verstößen',
    ],
    mehrwert:
      'Mehr Arbeitssicherheit und Unterstützung bei der Einhaltung gesetzlicher Vorgaben.',
  },
  {
    id: 'agent-bericht',
    slug: 'bericht',
    name: 'Berichtsagent',
    description: 'Erstellt automatisch strukturierte Berichte aus den vorhandenen Projektdaten.',
    category: 'analyse',
    status: 'entwurf',
    icon: 'FileText',
    nutzen: [
      'Tagesberichte',
      'Wochenberichte',
      'Monatsberichte',
      'Projektberichte',
      'Managementberichte',
      'Kundenberichte',
    ],
    mehrwert: 'Automatisierte Berichterstellung spart Zeit und schafft einheitliche Dokumentationen.',
  },
  {
    id: 'agent-kommunikation',
    slug: 'kommunikation',
    name: 'Kommunikationsagent',
    description: 'Analysiert und unterstützt die gesamte Unternehmenskommunikation.',
    category: 'kommunikation',
    status: 'entwurf',
    icon: 'Mail',
    nutzen: [
      'E-Mails zusammenfassen',
      'Aufgaben aus Nachrichten erzeugen',
      'Termine erkennen',
      'Antwortvorschläge erstellen',
      'Erinnerungen generieren',
      'Kommunikationsverläufe dokumentieren',
    ],
    mehrwert: 'Weniger Informationsverlust und effizientere Kommunikation.',
  },
  {
    id: 'agent-analyse',
    slug: 'analyse',
    name: 'Analyseagent',
    description:
      'Wertet Unternehmensdaten aus und liefert Entscheidungsgrundlagen auf Basis von KPIs und Trends.',
    category: 'analyse',
    status: 'entwurf',
    icon: 'LineChart',
    nutzen: [
      'KPI-Dashboards',
      'Kostenanalysen',
      'Umsatzentwicklungen',
      'Auslastungsanalysen',
      'Materialverbrauch',
      'Projektvergleiche',
      'Trendanalysen',
      'Prognosen und Forecasts',
    ],
    mehrwert:
      'Unterstützt datenbasierte Entscheidungen, macht aus vorhandenen Daten konkrete Handlungsempfehlungen und deckt Optimierungspotenziale frühzeitig auf.',
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
