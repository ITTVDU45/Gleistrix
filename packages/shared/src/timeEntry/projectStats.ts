/**
 * Aggregiert Projektlisten zu Kennzahlen (Anzahl je Status + Gesamtstunden).
 * Wiederverwendbar für Projektliste, Dashboard und Auswertungen.
 */

import { getProjectTotalHours, type ProjectWithTimes } from './projectHours'

export const AKTIV_STATUS = ['aktiv'] as const

export const ABGESCHLOSSEN_STATUS = ['abgeschlossen', 'fertiggestellt', 'geleistet'] as const

export interface ProjectWithStatus extends ProjectWithTimes {
  status?: string | null
}

export interface ProjectStats {
  gesamt: number
  aktiv: number
  abgeschlossen: number
  totalStunden: number
}

function matchesStatus(project: ProjectWithStatus, statuses: readonly string[]): boolean {
  const status = String(project?.status || '').trim().toLowerCase()
  return statuses.includes(status)
}

export function aggregateProjectStats(projects: ProjectWithStatus[]): ProjectStats {
  return (projects || []).reduce<ProjectStats>(
    (acc, project) => ({
      gesamt: acc.gesamt + 1,
      aktiv: acc.aktiv + (matchesStatus(project, AKTIV_STATUS) ? 1 : 0),
      abgeschlossen: acc.abgeschlossen + (matchesStatus(project, ABGESCHLOSSEN_STATUS) ? 1 : 0),
      totalStunden: acc.totalStunden + getProjectTotalHours(project),
    }),
    { gesamt: 0, aktiv: 0, abgeschlossen: 0, totalStunden: 0 }
  )
}
