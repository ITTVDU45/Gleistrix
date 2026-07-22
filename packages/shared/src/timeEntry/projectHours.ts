import { normalizeProjectTimeEntriesToBillingRows, isContinuationEntry } from './billingRows'

export type ProjectWithTimes = {
  mitarbeiterZeiten?: Record<string, any[] | undefined>
}

/**
 * Gesamtstunden eines Projekts. Fortsetzungszeilen bleiben außen vor, weil ihre
 * Stunden bereits im Eintrag des Vortages enthalten sind – analog zu allen
 * anderen Auswertungen (Zeiterfassung, Projektdetail, Projektliste).
 */
export function getProjectTotalHours(project: ProjectWithTimes): number {
  const rows = normalizeProjectTimeEntriesToBillingRows(project?.mitarbeiterZeiten || {})
  return rows.reduce(
    (sum, row) => (isContinuationEntry(row) ? sum : sum + (Number(row.stundenTotal) || 0)),
    0
  )
}
