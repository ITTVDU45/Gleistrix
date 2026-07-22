/**
 * Farbliche fachliche Einordnung der Projekte in der Einsatztafel.
 * Statusfarben spiegeln die Badges der Projektseite (siehe InlineStatusSelect).
 * Zusätzlich: Schichtfarben für erfasste Tage (Früh-/Tagschicht vs. Nachtschicht).
 */

export type ProjectShift = 'tag' | 'nacht'

// Statusfarben (Hex, abgeleitet aus den Tailwind-Badges der Projektseite)
export const PROJECT_STATUS_COLORS: Record<string, string> = {
  aktiv: '#22c55e', // grün
  abgeschlossen: '#06b6d4', // cyan/blau
  fertiggestellt: '#a855f7', // violett
  geleistet: '#eab308', // gelb
  teilweise_abgerechnet: '#3b82f6', // blau
  'kein Status': '#9ca3af', // grau
}

export const NOT_STARTED_COLOR = '#ca8a04' // Senf/Gelb — Laufzeit noch nicht begonnen
export const SHIFT_DAY_COLOR = '#10b981' // Tag-/Frühschicht (anderes Grün)
export const SHIFT_NIGHT_COLOR = '#ef4444' // Nachtschicht

const DAY_START_MIN = 5 * 60 // 05:00
const DAY_END_MIN = 12 * 60 // 12:00

export function getStatusColor(status?: string): string {
  return PROJECT_STATUS_COLORS[status || ''] || PROJECT_STATUS_COLORS['kein Status']
}

/**
 * Farbe des geplanten Laufzeit-Balkens: Statusfarbe, oder Senf wenn das Projekt
 * noch nicht gestartet ist (Startdatum in der Zukunft).
 */
export function getPlannedColor(status?: string, notStarted?: boolean): string {
  return notStarted ? NOT_STARTED_COLOR : getStatusColor(status)
}

export function getShiftColor(shift: ProjectShift): string {
  return shift === 'nacht' ? SHIFT_NIGHT_COLOR : SHIFT_DAY_COLOR
}

// --- Schichterkennung (TZ-sicher direkt aus dem ISO-String geparst) ---

function timeToMinutes(iso?: string): number | null {
  if (!iso) return null
  const m = iso.match(/T(\d{2}):(\d{2})/)
  if (!m) return null
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10)
}

function dateOf(iso?: string): string | null {
  if (!iso) return null
  const m = iso.match(/^(\d{4}-\d{2}-\d{2})/)
  return m ? m[1] : null
}

/**
 * Ein Zeiteintrag ist Nachtschicht, wenn er über Mitternacht geht oder außerhalb
 * des Fensters 05:00–12:00 liegt. Sonst Tag-/Frühschicht.
 */
export function detectEntryShift(start?: string, ende?: string): ProjectShift {
  const startMin = timeToMinutes(start)
  if (startMin == null) return 'tag'

  const sDate = dateOf(start)
  const eDate = dateOf(ende)
  if (sDate && eDate && eDate > sDate) return 'nacht' // über Mitternacht

  if (startMin < DAY_START_MIN) return 'nacht'
  const endMin = timeToMinutes(ende)
  if (endMin != null && endMin > DAY_END_MIN) return 'nacht'
  return 'tag'
}

/** Ein Tag gilt als Nachtschicht, sobald ein Eintrag Nachtschicht ist. */
export function detectDayShift(entries: Array<{ start?: string; ende?: string }>): ProjectShift {
  for (const e of entries) {
    if (detectEntryShift(e.start, e.ende) === 'nacht') return 'nacht'
  }
  return 'tag'
}
