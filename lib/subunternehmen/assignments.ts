import {
  normalizeProjectTimeEntriesToBillingRows,
  type BillingRow,
  type TimeEntryLike,
} from '@/lib/timeEntry/billingRows'
import type {
  SubcontractorAssignment,
  SubcontractorAssignmentStatus,
} from '@/types/subunternehmen'

export interface ProjectLike {
  _id?: unknown
  id?: string
  name?: string
  auftragsnummer?: string
  baustelle?: string
  status?: string
  datumBeginn?: string
  datumEnde?: string
  mitarbeiterZeiten?: Record<string, TimeEntryLike[] | undefined>
  abgerechneteTage?: string[]
}

export const buildAssignmentKey = (projectId: string, rowKey: string): string =>
  `${projectId}::${rowKey}`

/**
 * Filtert die Abrechnungszeilen eines Projekts auf die externen Einsätze
 * GENAU EINES Subunternehmens. Zuordnung ausschließlich über
 * `externalCompanyId` – niemals über den Firmennamen (Verwechslungsgefahr).
 */
export function extractCompanyBillingRows(
  project: ProjectLike,
  companyId: string
): BillingRow[] {
  const rows = normalizeProjectTimeEntriesToBillingRows(project.mitarbeiterZeiten || {})
  return rows.filter(
    (row) =>
      row.isExternal &&
      String(row.sourceEntry?.externalCompanyId || '') === String(companyId)
  )
}

/**
 * Einsatzstatus aus Portal-Sicht:
 * - geplant: Einsatztag liegt in der Zukunft
 * - durchgefuehrt: Tag vergangen, aber keine Stunden bestätigt
 * - bestaetigt: Stunden erfasst/bestätigt, noch nicht in einer Rechnung
 * - teilweise/vollstaendig_abgerechnet: je nach Rechnungszuordnung
 */
export function deriveAssignmentStatus(
  row: BillingRow,
  options: { today: string; invoicedKeys: Set<string>; projectId: string }
): SubcontractorAssignmentStatus {
  const key = buildAssignmentKey(options.projectId, row.rowKey)
  if (options.invoicedKeys.has(key)) return 'vollstaendig_abgerechnet'
  const hasConfirmedHours = (row.stundenTotal || 0) > 0
  if (row.day > options.today) return 'geplant'
  if (!hasConfirmedHours) return 'durchgefuehrt'
  return 'bestaetigt'
}

export interface ToAssignmentsOptions {
  today: string
  /** assignmentKeys, die bereits in nicht-stornierten Rechnungen verwendet werden */
  invoicedKeys: Set<string>
  /** Rechnungsnummern je assignmentKey (für die Anzeige) */
  invoiceNumbersByKey?: Map<string, string[]>
}

/** Wandelt die Abrechnungszeilen eines Projekts in Portal-Einsätze um. */
export function toSubcontractorAssignments(
  project: ProjectLike,
  companyId: string,
  options: ToAssignmentsOptions
): SubcontractorAssignment[] {
  const projectId = String(project.id || project._id || '')
  const rows = extractCompanyBillingRows(project, companyId)
  return rows.map((row) => {
    const assignmentKey = buildAssignmentKey(projectId, row.rowKey)
    return {
      assignmentKey,
      projectId,
      projectName: String(project.name || ''),
      projectNumber: project.auftragsnummer ? String(project.auftragsnummer) : undefined,
      day: row.day,
      funktion: row.funktion,
      count: row.count,
      start: row.start,
      ende: row.ende,
      pause: row.pause,
      stundenPerUnit: row.stundenPerUnit,
      stundenTotal: row.stundenTotal,
      fahrtstundenTotal: row.fahrtstundenTotal,
      nachtzulageTotal: row.nachtzulageTotal,
      sonntagsstundenTotal: row.sonntagsstundenTotal,
      feiertagTotal: row.feiertagTotal,
      extraTotal: row.extraTotal,
      status: deriveAssignmentStatus(row, { ...options, projectId }),
      invoiceNumbers: options.invoiceNumbersByKey?.get(assignmentKey),
      bemerkung: row.bemerkung || undefined,
    }
  })
}

export interface AssignmentSums {
  stunden: number
  fahrtstunden: number
  nachtzulage: number
  sonntagsstunden: number
  feiertag: number
  extra: number
  einsaetze: number
  mitarbeiter: number
}

export function sumAssignments(assignments: SubcontractorAssignment[]): AssignmentSums {
  return assignments.reduce<AssignmentSums>(
    (acc, a) => ({
      stunden: acc.stunden + (a.stundenTotal || 0),
      fahrtstunden: acc.fahrtstunden + (a.fahrtstundenTotal || 0),
      nachtzulage: acc.nachtzulage + (a.nachtzulageTotal || 0),
      sonntagsstunden: acc.sonntagsstunden + (a.sonntagsstundenTotal || 0),
      feiertag: acc.feiertag + (a.feiertagTotal || 0),
      extra: acc.extra + (a.extraTotal || 0),
      einsaetze: acc.einsaetze + 1,
      mitarbeiter: acc.mitarbeiter + (a.count || 0),
    }),
    { stunden: 0, fahrtstunden: 0, nachtzulage: 0, sonntagsstunden: 0, feiertag: 0, extra: 0, einsaetze: 0, mitarbeiter: 0 }
  )
}
