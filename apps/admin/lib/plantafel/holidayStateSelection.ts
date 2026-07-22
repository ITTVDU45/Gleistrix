/**
 * Auswahllogik des Bundesland-Filters für deutsche Feiertage.
 *
 * Eine leere `holidayStates`-Liste bedeutet "alle 16 Bundesländer" — das ist
 * der Standard und auch die Konvention der Assignments-API. Da es damit keine
 * eigene Darstellung für "kein Bundesland" gibt, wird das Abwählen des letzten
 * Landes auf den Hauptschalter `showGermanHolidays` abgebildet: keine Auswahl
 * heißt keine deutschen Feiertage. Ist der Schalter aus, gilt die leere Liste
 * folglich als "keines" statt als "alle".
 */

export interface HolidayStateSelection {
  holidayStates: string[]
  showGermanHolidays: boolean
}

export function toggleHolidayState(
  current: HolidayStateSelection,
  allCodes: string[],
  code: string,
  checked: boolean
): HolidayStateSelection {
  // Leere Auswahl bei aktiven Feiertagen steht für "alle" — zum Abwählen erst
  // explizit machen, sonst liefe das Entfernen ins Leere.
  const effective = !current.showGermanHolidays
    ? []
    : current.holidayStates.length === 0
      ? allCodes
      : current.holidayStates

  const next = new Set(effective)
  if (checked) next.add(code)
  else next.delete(code)

  const codes = allCodes.filter((c) => next.has(c))

  if (codes.length === 0) {
    return { holidayStates: [], showGermanHolidays: false }
  }

  return {
    holidayStates: codes.length === allCodes.length ? [] : codes,
    showGermanHolidays: true,
  }
}
