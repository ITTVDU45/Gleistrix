/**
 * Islamische Feiertage nach DITIB-Vorgabe.
 *
 * QUELLE — bitte beim Erweitern beibehalten:
 * Diyanet İşleri Başkanlığı, "Dini Günler" (https://vakithesaplama.diyanet.gov.tr/dini_gunler.php).
 * DITIB folgt als deutscher Zweig der Diyanet-Berechnung; die Daten wurden
 * gegen die DITIB-Gemeindeveröffentlichung für 2026 gegengeprüft und über die
 * in der Quelle angegebenen Wochentage gegen den gregorianischen Kalender
 * verifiziert.
 *
 * ACHTUNG bei Drittquellen: Viele Kalenderseiten zählen den Arife-Tag (Vortag)
 * als ersten Festtag und liegen dadurch einen Tag daneben. Maßgeblich ist die
 * Diyanet-Zeile "1. Gün".
 *
 * WARUM EINE TABELLE UND KEINE FORMEL:
 * Diyanet legt den Monatsbeginn astronomisch nach den Kriterien der Istanbuler
 * Konferenz von 1978 fest (Neumond vor Sonnenuntergang, Mondhöhe >= 5°,
 * Elongation >= 8°). Das ist mit den tabellarischen Kalendern von
 * `Intl` (`islamic-civil`, `islamic-umalqura`) nicht reproduzierbar — diese
 * weichen regelmäßig um ein bis zwei Tage ab. Ein Näherungsverfahren würde
 * also zuverlässig falsche Tage liefern, deshalb die gepflegte Liste.
 *
 * ZEITRECHNUNG:
 * Die Daten gelten so, wie DITIB sie für Deutschland veröffentlicht
 * (Tagesgrenzen in Europa/Berlin). Sie werden als `YYYY-MM-DD`-Schlüssel
 * geführt, damit keine Zeitzonen-Umrechnung das Datum verschieben kann.
 *
 * ERWEITERN: Diyanet veröffentlicht die Listen bis 2035. Neue Jahre unten
 * anfügen und `ISLAMIC_HOLIDAY_COVERAGE` mitziehen; die Tests prüfen die
 * Kalender-Konsistenz der Einträge automatisch mit.
 */

export type IslamicHolidayId = 'ramadanbeginn' | 'ramadanfest' | 'opferfest'

export interface IslamicHolidayEntry {
  /** `YYYY-MM-DD` */
  dateKey: string
  id: IslamicHolidayId
  /** Tag innerhalb des mehrtägigen Festes (1-basiert); 1 bei Einzeltagen. */
  day: number
}

export const ISLAMIC_HOLIDAY_NAMES: Record<IslamicHolidayId, string> = {
  ramadanbeginn: 'Ramadanbeginn',
  ramadanfest: 'Ramadanfest',
  opferfest: 'Opferfest',
}

/** Anzahl Tage je Fest nach Diyanet-Zählung. */
export const ISLAMIC_HOLIDAY_LENGTHS: Record<IslamicHolidayId, number> = {
  ramadanbeginn: 1,
  ramadanfest: 3,
  opferfest: 4,
}

/**
 * Abgedeckter Zeitraum. Außerhalb liefert die Berechnung bewusst nichts,
 * statt zu raten.
 *
 * Randfall: Der Ramadanbeginn vom 15.12.2031 gehört zu einem Fest, das erst
 * im Januar 2032 endet — dieses Ramadanfest liegt außerhalb der Abdeckung.
 */
export const ISLAMIC_HOLIDAY_COVERAGE = {
  fromDateKey: '2025-01-01',
  toDateKey: '2031-12-31',
} as const

export const ISLAMIC_HOLIDAY_DATES: readonly IslamicHolidayEntry[] = [
  // 2025
  { dateKey: '2025-03-01', id: 'ramadanbeginn', day: 1 },
  { dateKey: '2025-03-30', id: 'ramadanfest', day: 1 },
  { dateKey: '2025-03-31', id: 'ramadanfest', day: 2 },
  { dateKey: '2025-04-01', id: 'ramadanfest', day: 3 },
  { dateKey: '2025-06-06', id: 'opferfest', day: 1 },
  { dateKey: '2025-06-07', id: 'opferfest', day: 2 },
  { dateKey: '2025-06-08', id: 'opferfest', day: 3 },
  { dateKey: '2025-06-09', id: 'opferfest', day: 4 },

  // 2026
  { dateKey: '2026-02-19', id: 'ramadanbeginn', day: 1 },
  { dateKey: '2026-03-20', id: 'ramadanfest', day: 1 },
  { dateKey: '2026-03-21', id: 'ramadanfest', day: 2 },
  { dateKey: '2026-03-22', id: 'ramadanfest', day: 3 },
  { dateKey: '2026-05-27', id: 'opferfest', day: 1 },
  { dateKey: '2026-05-28', id: 'opferfest', day: 2 },
  { dateKey: '2026-05-29', id: 'opferfest', day: 3 },
  { dateKey: '2026-05-30', id: 'opferfest', day: 4 },

  // 2027
  { dateKey: '2027-02-08', id: 'ramadanbeginn', day: 1 },
  { dateKey: '2027-03-09', id: 'ramadanfest', day: 1 },
  { dateKey: '2027-03-10', id: 'ramadanfest', day: 2 },
  { dateKey: '2027-03-11', id: 'ramadanfest', day: 3 },
  { dateKey: '2027-05-16', id: 'opferfest', day: 1 },
  { dateKey: '2027-05-17', id: 'opferfest', day: 2 },
  { dateKey: '2027-05-18', id: 'opferfest', day: 3 },
  { dateKey: '2027-05-19', id: 'opferfest', day: 4 },

  // 2028
  { dateKey: '2028-01-28', id: 'ramadanbeginn', day: 1 },
  { dateKey: '2028-02-26', id: 'ramadanfest', day: 1 },
  { dateKey: '2028-02-27', id: 'ramadanfest', day: 2 },
  { dateKey: '2028-02-28', id: 'ramadanfest', day: 3 },
  { dateKey: '2028-05-05', id: 'opferfest', day: 1 },
  { dateKey: '2028-05-06', id: 'opferfest', day: 2 },
  { dateKey: '2028-05-07', id: 'opferfest', day: 3 },
  { dateKey: '2028-05-08', id: 'opferfest', day: 4 },

  // 2029
  { dateKey: '2029-01-16', id: 'ramadanbeginn', day: 1 },
  { dateKey: '2029-02-14', id: 'ramadanfest', day: 1 },
  { dateKey: '2029-02-15', id: 'ramadanfest', day: 2 },
  { dateKey: '2029-02-16', id: 'ramadanfest', day: 3 },
  { dateKey: '2029-04-24', id: 'opferfest', day: 1 },
  { dateKey: '2029-04-25', id: 'opferfest', day: 2 },
  { dateKey: '2029-04-26', id: 'opferfest', day: 3 },
  { dateKey: '2029-04-27', id: 'opferfest', day: 4 },

  // 2030 — zwei Ramadananfänge, da das Hidschri-Jahr rund 11 Tage kürzer ist
  { dateKey: '2030-01-05', id: 'ramadanbeginn', day: 1 },
  { dateKey: '2030-02-04', id: 'ramadanfest', day: 1 },
  { dateKey: '2030-02-05', id: 'ramadanfest', day: 2 },
  { dateKey: '2030-02-06', id: 'ramadanfest', day: 3 },
  { dateKey: '2030-04-13', id: 'opferfest', day: 1 },
  { dateKey: '2030-04-14', id: 'opferfest', day: 2 },
  { dateKey: '2030-04-15', id: 'opferfest', day: 3 },
  { dateKey: '2030-04-16', id: 'opferfest', day: 4 },
  { dateKey: '2030-12-26', id: 'ramadanbeginn', day: 1 },

  // 2031 — das Ramadanfest gehört zum Ramadan, der am 26.12.2030 begann
  { dateKey: '2031-01-24', id: 'ramadanfest', day: 1 },
  { dateKey: '2031-01-25', id: 'ramadanfest', day: 2 },
  { dateKey: '2031-01-26', id: 'ramadanfest', day: 3 },
  { dateKey: '2031-04-02', id: 'opferfest', day: 1 },
  { dateKey: '2031-04-03', id: 'opferfest', day: 2 },
  { dateKey: '2031-04-04', id: 'opferfest', day: 3 },
  { dateKey: '2031-04-05', id: 'opferfest', day: 4 },
  { dateKey: '2031-12-15', id: 'ramadanbeginn', day: 1 },
]
