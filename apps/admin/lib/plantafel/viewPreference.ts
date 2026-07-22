/**
 * Merkt die zuletzt gewählte Ansicht der Einsatztafel (Team/Projekt und
 * Tag/Woche/Monat/Jahr), damit die Auswahl einen Seiten-Reload überlebt.
 */

import type { PlantafelCalendarView, PlantafelView } from '@/components/plantafel/types'

export const VIEW_PREFERENCE_STORAGE_KEY = 'plantafel-view-preference'

export interface PlantafelViewPreference {
  view: PlantafelView
  calendarView: PlantafelCalendarView
}

const VALID_VIEWS: readonly PlantafelView[] = ['team', 'project']
const VALID_CALENDAR_VIEWS: readonly PlantafelCalendarView[] = ['day', 'week', 'month', 'year']

/**
 * Liest eine gespeicherte Auswahl aus einem JSON-String. Unbekannte oder
 * beschädigte Werte werden verworfen, damit ein manipulierter Speicher die
 * Tafel nicht in einen ungültigen Zustand bringt.
 */
export function parseViewPreference(raw: string | null): Partial<PlantafelViewPreference> {
  if (!raw) return {}

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return {}
  }

  if (!parsed || typeof parsed !== 'object') return {}

  const candidate = parsed as Record<string, unknown>
  const result: Partial<PlantafelViewPreference> = {}

  if (VALID_VIEWS.includes(candidate.view as PlantafelView)) {
    result.view = candidate.view as PlantafelView
  }
  if (VALID_CALENDAR_VIEWS.includes(candidate.calendarView as PlantafelCalendarView)) {
    result.calendarView = candidate.calendarView as PlantafelCalendarView
  }

  return result
}

export function serializeViewPreference(preference: PlantafelViewPreference): string {
  return JSON.stringify(preference)
}

/** Gespeicherte Auswahl lesen; ohne Browser-Storage bleibt sie leer. */
export function readViewPreference(): Partial<PlantafelViewPreference> {
  if (typeof window === 'undefined') return {}
  try {
    return parseViewPreference(window.localStorage.getItem(VIEW_PREFERENCE_STORAGE_KEY))
  } catch {
    // Privater Modus oder gesperrter Storage — Standardansicht ist dann korrekt.
    return {}
  }
}

export function writeViewPreference(preference: PlantafelViewPreference): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(VIEW_PREFERENCE_STORAGE_KEY, serializeViewPreference(preference))
  } catch {
    // Speichern ist optional; ein Fehler darf die Tafel nicht blockieren.
  }
}
