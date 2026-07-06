/**
 * Aggregiert Zeiteinträge (Billing-Row-Form) nach Funktion und summiert Extra-Stunden.
 * Wiederverwendbar für Zeiterfassung, Projekte, Projektdetail und Projektliste.
 *
 * Erwartete Felder pro Eintrag: funktion, stunden, extra, isExternal, externalCount.
 * Externe Einträge werden mit ihrer Personenanzahl multipliziert (analog
 * DynamicTimeTrackingStats).
 */

export interface HoursByFunctionEntry {
  funktion?: string | null
  stunden?: number | string | null
  extra?: number | string | null
  fahrtstunden?: number | string | null
  isExternal?: boolean
  externalCount?: number | string | null
}

export interface FunktionHoursRow {
  funktion: string
  stunden: number
  extra: number
  fahrtstunden: number
  eintraege: number
}

export interface HoursByFunctionResult {
  rows: FunktionHoursRow[]
  totalStunden: number
  totalExtra: number
  totalFahrtstunden: number
  totalEintraege: number
}

const UNBEKANNT = 'Ohne Funktion'

function toNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (value == null) return 0
  const n = parseFloat(String(value).replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

function multiplierOf(entry: HoursByFunctionEntry): number {
  if (!entry.isExternal) return 1
  const count = toNumber(entry.externalCount)
  return count > 0 ? count : 1
}

export function aggregateHoursByFunction(entries: HoursByFunctionEntry[]): HoursByFunctionResult {
  const map = new Map<string, FunktionHoursRow>()
  let totalStunden = 0
  let totalExtra = 0
  let totalFahrtstunden = 0
  let totalEintraege = 0

  for (const entry of entries) {
    const funktion = String(entry.funktion || '').trim() || UNBEKANNT
    const mult = multiplierOf(entry)
    const stunden = toNumber(entry.stunden) * mult
    const extra = toNumber(entry.extra) * mult
    const fahrtstunden = toNumber(entry.fahrtstunden) * mult

    const row = map.get(funktion) || { funktion, stunden: 0, extra: 0, fahrtstunden: 0, eintraege: 0 }
    row.stunden += stunden
    row.extra += extra
    row.fahrtstunden += fahrtstunden
    row.eintraege += 1
    map.set(funktion, row)

    totalStunden += stunden
    totalExtra += extra
    totalFahrtstunden += fahrtstunden
    totalEintraege += 1
  }

  const rows = Array.from(map.values()).sort((a, b) => b.stunden - a.stunden)

  return { rows, totalStunden, totalExtra, totalFahrtstunden, totalEintraege }
}

/** Stunden als H:MM formatieren (z.B. 8.5 → "8:30"). */
export function formatFunctionHours(hours: number): string {
  const safe = Number.isFinite(hours) ? hours : 0
  const whole = Math.floor(safe)
  const minutes = Math.round((safe - whole) * 60)
  if (minutes === 60) return `${whole + 1}:00`
  return `${whole}:${String(minutes).padStart(2, '0')}`
}
