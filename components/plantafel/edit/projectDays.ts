import { format } from 'date-fns'
import type { Project } from '../../../types'

/**
 * Liefert alle Projekttage (datumBeginn..datumEnde) als yyyy-MM-dd.
 * Entspricht der getProjectDays-Logik der Projektdetailseite.
 */
export function getProjectDays(project: Pick<Project, 'datumBeginn' | 'datumEnde'>): string[] {
  const startSource = project.datumBeginn || new Date().toISOString()
  const endSource = project.datumEnde || project.datumBeginn || new Date().toISOString()
  const start = new Date(startSource)
  const end = new Date(endSource)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return []

  const days: string[] = []
  const current = new Date(start)
  let guard = 0
  while (current <= end && guard < 1000) {
    days.push(format(current, 'yyyy-MM-dd'))
    current.setDate(current.getDate() + 1)
    guard += 1
  }
  return days
}
