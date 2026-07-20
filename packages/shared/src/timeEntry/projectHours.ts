import { normalizeProjectTimeEntriesToBillingRows } from './billingRows'

type ProjectWithTimes = {
  mitarbeiterZeiten?: Record<string, any[] | undefined>
}

export function getProjectTotalHours(project: ProjectWithTimes): number {
  const rows = normalizeProjectTimeEntriesToBillingRows(project?.mitarbeiterZeiten || {})
  return rows.reduce((sum, row) => sum + (Number(row.stundenTotal) || 0), 0)
}
