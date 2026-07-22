/**
 * Gesetzliche Feiertage in Deutschland – bundesweit und regional.
 *
 * Quelle der Regeln sind die Feiertagsgesetze der Länder. Jede Definition
 * beschreibt, WANN der Feiertag liegt (feste Datumsregel oder Osterbezug) und
 * WO er gilt (je Bundesland, optional mit Gültigkeitszeitraum).
 *
 * Wichtig: `partial: true` bedeutet, dass der Tag nur in Teilen des Landes
 * gesetzlicher Feiertag ist (z. B. Fronleichnam nur in katholisch geprägten
 * Gemeinden Sachsens). Solche Tage werden in der UI gesondert gekennzeichnet.
 */

import { GERMAN_STATE_CODES, type GermanStateCode } from './germanStates'
import { getBussUndBettag } from './dateUtils'

/** Gültigkeit eines Feiertags in einem einzelnen Bundesland. */
export interface StateValidity {
  /** Erstes Jahr, in dem der Feiertag dort gilt (inklusive). */
  from?: number
  /** Letztes Jahr, in dem der Feiertag dort gilt (inklusive). */
  to?: number
  /** Nur in Teilen des Landes gesetzlicher Feiertag (einzelne Gemeinden). */
  partial?: boolean
  /** Erläuterung zur regionalen Einschränkung. */
  note?: string
}

/**
 * Gültigkeit je Bundesland. Mehrere Einträge erlauben unterbrochene Zeiträume
 * (z. B. der Tag der Befreiung in Berlin: nur 2020 und nur 2025).
 */
export type HolidayStateMap = Partial<Record<GermanStateCode, StateValidity | StateValidity[]>>

/** Zeitregel eines Feiertags. */
export type HolidayRule =
  | { kind: 'fixed'; month: number; day: number }
  /** Tage relativ zum Ostersonntag (0 = Ostersonntag). */
  | { kind: 'easter'; offset: number }
  | { kind: 'computed'; resolve: (year: number) => Date }

export interface GermanHolidayDefinition {
  /** Stabile, technische ID (kebab-case). */
  id: string
  name: string
  rule: HolidayRule
  /** In welchen Bundesländern der Tag gesetzlicher Feiertag ist. */
  states: HolidayStateMap
}

/** Baut eine `HolidayStateMap` für eine Liste von Ländern mit gleicher Gültigkeit. */
function inStates(
  codes: readonly GermanStateCode[],
  validity: StateValidity | StateValidity[] = {}
): HolidayStateMap {
  const map: HolidayStateMap = {}
  for (const code of codes) map[code] = validity
  return map
}

/** Bundesweit gültig – alle 16 Länder. */
function nationwide(validity: StateValidity | StateValidity[] = {}): HolidayStateMap {
  return inStates(GERMAN_STATE_CODES, validity)
}

export const GERMAN_HOLIDAY_DEFINITIONS: readonly GermanHolidayDefinition[] = [
  // ---------------------------------------------------------------------
  // Bundesweite Feiertage
  // ---------------------------------------------------------------------
  {
    id: 'neujahr',
    name: 'Neujahr',
    rule: { kind: 'fixed', month: 1, day: 1 },
    states: nationwide(),
  },
  {
    id: 'karfreitag',
    name: 'Karfreitag',
    rule: { kind: 'easter', offset: -2 },
    states: nationwide(),
  },
  {
    id: 'ostermontag',
    name: 'Ostermontag',
    rule: { kind: 'easter', offset: 1 },
    states: nationwide(),
  },
  {
    id: 'tag-der-arbeit',
    name: 'Tag der Arbeit',
    rule: { kind: 'fixed', month: 5, day: 1 },
    states: nationwide(),
  },
  {
    id: 'christi-himmelfahrt',
    name: 'Christi Himmelfahrt',
    rule: { kind: 'easter', offset: 39 },
    states: nationwide(),
  },
  {
    id: 'pfingstmontag',
    name: 'Pfingstmontag',
    rule: { kind: 'easter', offset: 50 },
    states: nationwide(),
  },
  {
    id: 'tag-der-deutschen-einheit',
    name: 'Tag der Deutschen Einheit',
    rule: { kind: 'fixed', month: 10, day: 3 },
    states: nationwide({ from: 1990 }),
  },
  {
    id: 'erster-weihnachtstag',
    name: '1. Weihnachtstag',
    rule: { kind: 'fixed', month: 12, day: 25 },
    states: nationwide(),
  },
  {
    id: 'zweiter-weihnachtstag',
    name: '2. Weihnachtstag',
    rule: { kind: 'fixed', month: 12, day: 26 },
    states: nationwide(),
  },

  // ---------------------------------------------------------------------
  // Regionale Feiertage
  // ---------------------------------------------------------------------
  {
    id: 'heilige-drei-koenige',
    name: 'Heilige Drei Könige',
    rule: { kind: 'fixed', month: 1, day: 6 },
    states: inStates(['BW', 'BY', 'ST']),
  },
  {
    id: 'internationaler-frauentag',
    name: 'Internationaler Frauentag',
    rule: { kind: 'fixed', month: 3, day: 8 },
    states: {
      ...inStates(['BE'], { from: 2019 }),
      ...inStates(['MV'], { from: 2023 }),
    },
  },
  {
    id: 'ostersonntag',
    name: 'Ostersonntag',
    rule: { kind: 'easter', offset: 0 },
    states: inStates(['BB']),
  },
  {
    id: 'tag-der-befreiung',
    name: 'Tag der Befreiung',
    rule: { kind: 'fixed', month: 5, day: 8 },
    // Einmalige gesetzliche Feiertage in Berlin (75. und 80. Jahrestag).
    states: inStates(['BE'], [
      { from: 2020, to: 2020 },
      { from: 2025, to: 2025 },
    ]),
  },
  {
    id: 'pfingstsonntag',
    name: 'Pfingstsonntag',
    rule: { kind: 'easter', offset: 49 },
    states: inStates(['BB']),
  },
  {
    id: 'fronleichnam',
    name: 'Fronleichnam',
    rule: { kind: 'easter', offset: 60 },
    states: {
      ...inStates(['BW', 'BY', 'HE', 'NW', 'RP', 'SL']),
      ...inStates(['SN', 'TH'], {
        partial: true,
        note: 'nur in überwiegend katholisch geprägten Gemeinden',
      }),
    },
  },
  {
    id: 'augsburger-friedensfest',
    name: 'Augsburger Hohes Friedensfest',
    rule: { kind: 'fixed', month: 8, day: 8 },
    states: inStates(['BY'], { partial: true, note: 'nur im Stadtgebiet Augsburg' }),
  },
  {
    id: 'mariae-himmelfahrt',
    name: 'Mariä Himmelfahrt',
    rule: { kind: 'fixed', month: 8, day: 15 },
    states: {
      ...inStates(['SL']),
      ...inStates(['BY'], {
        partial: true,
        note: 'nur in Gemeinden mit überwiegend katholischer Bevölkerung',
      }),
    },
  },
  {
    id: 'weltkindertag',
    name: 'Weltkindertag',
    rule: { kind: 'fixed', month: 9, day: 20 },
    states: inStates(['TH'], { from: 2019 }),
  },
  {
    id: 'reformationstag',
    name: 'Reformationstag',
    rule: { kind: 'fixed', month: 10, day: 31 },
    states: {
      ...inStates(['BB', 'MV', 'SN', 'ST', 'TH']),
      // Die Nordländer haben den Tag ab 2018 dauerhaft eingeführt; 2017 galt er
      // dort – wie bundesweit – bereits einmalig (500 Jahre Reformation).
      ...inStates(['HB', 'HH', 'NI', 'SH'], { from: 2017 }),
      ...inStates(['BW', 'BY', 'BE', 'HE', 'NW', 'RP', 'SL'], { from: 2017, to: 2017 }),
    },
  },
  {
    id: 'allerheiligen',
    name: 'Allerheiligen',
    rule: { kind: 'fixed', month: 11, day: 1 },
    states: inStates(['BW', 'BY', 'NW', 'RP', 'SL']),
  },
  {
    id: 'buss-und-bettag',
    name: 'Buß- und Bettag',
    rule: { kind: 'computed', resolve: getBussUndBettag },
    states: {
      // Bis 1994 bundesweit, seit 1995 nur noch in Sachsen.
      ...nationwide({ to: 1994 }),
      ...inStates(['SN'], {}),
    },
  },
] as const
