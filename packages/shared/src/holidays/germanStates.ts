/**
 * Die 16 deutschen Bundesländer.
 *
 * Die Codes entsprechen den amtlichen Länderkürzeln (ISO 3166-2:DE ohne den
 * `DE-`-Präfix) und werden so auch im `Holiday`-Model (`bundesland`) verwendet.
 */

export type GermanStateCode =
  | 'BW'
  | 'BY'
  | 'BE'
  | 'BB'
  | 'HB'
  | 'HH'
  | 'HE'
  | 'MV'
  | 'NI'
  | 'NW'
  | 'RP'
  | 'SL'
  | 'SN'
  | 'ST'
  | 'SH'
  | 'TH'

export interface GermanState {
  code: GermanStateCode
  /** Vollständiger Name, z. B. "Nordrhein-Westfalen" */
  name: string
  /** Kurzform für enge UI-Elemente, z. B. "NRW" */
  shortName: string
}

export const GERMAN_STATES: readonly GermanState[] = [
  { code: 'BW', name: 'Baden-Württemberg', shortName: 'BW' },
  { code: 'BY', name: 'Bayern', shortName: 'BY' },
  { code: 'BE', name: 'Berlin', shortName: 'BE' },
  { code: 'BB', name: 'Brandenburg', shortName: 'BB' },
  { code: 'HB', name: 'Bremen', shortName: 'HB' },
  { code: 'HH', name: 'Hamburg', shortName: 'HH' },
  { code: 'HE', name: 'Hessen', shortName: 'HE' },
  { code: 'MV', name: 'Mecklenburg-Vorpommern', shortName: 'MV' },
  { code: 'NI', name: 'Niedersachsen', shortName: 'NI' },
  { code: 'NW', name: 'Nordrhein-Westfalen', shortName: 'NRW' },
  { code: 'RP', name: 'Rheinland-Pfalz', shortName: 'RP' },
  { code: 'SL', name: 'Saarland', shortName: 'SL' },
  { code: 'SN', name: 'Sachsen', shortName: 'SN' },
  { code: 'ST', name: 'Sachsen-Anhalt', shortName: 'ST' },
  { code: 'SH', name: 'Schleswig-Holstein', shortName: 'SH' },
  { code: 'TH', name: 'Thüringen', shortName: 'TH' },
] as const

export const GERMAN_STATE_CODES: readonly GermanStateCode[] = GERMAN_STATES.map((s) => s.code)

const STATE_BY_CODE = new Map<string, GermanState>(GERMAN_STATES.map((s) => [s.code, s]))

/** Type-Guard für unbekannte Eingaben (Query-Parameter, DB-Werte). */
export function isGermanStateCode(value: unknown): value is GermanStateCode {
  return typeof value === 'string' && STATE_BY_CODE.has(value)
}

/** Vollständiger Ländername; fällt auf den Code zurück, wenn unbekannt. */
export function getGermanStateName(code: string): string {
  return STATE_BY_CODE.get(code)?.name ?? code
}

/** Kurzform des Ländernamens; fällt auf den Code zurück, wenn unbekannt. */
export function getGermanStateShortName(code: string): string {
  return STATE_BY_CODE.get(code)?.shortName ?? code
}

/**
 * Filtert eine beliebige Liste auf gültige Bundesland-Codes und entfernt
 * Duplikate. Reihenfolge folgt `GERMAN_STATES`, damit die Ausgabe stabil ist.
 */
export function normalizeStateCodes(values: readonly unknown[]): GermanStateCode[] {
  const wanted = new Set(values.filter(isGermanStateCode))
  return GERMAN_STATE_CODES.filter((code) => wanted.has(code))
}
