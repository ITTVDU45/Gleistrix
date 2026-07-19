import type { SubcontractorAssignment } from '@/types/subunternehmen'
import {
  toSubcontractorAssignments,
  type ProjectLike,
  type ToAssignmentsOptions,
  sumAssignments,
} from '@/lib/subunternehmen/assignments'

/**
 * Whitelist-Projektion eines Projekts für das Subunternehmen-Portal.
 * WICHTIG: Es werden ausschließlich explizit freigegebene Felder übernommen.
 * Niemals das Rohdokument weitergeben – `Project` ist strict:false und
 * enthält interne Kalkulationen (leistungen[].einzelpreis), interne
 * Mitarbeiterzeiten, Fahrzeuge, Dokumente und Notizen.
 */
export interface SanitizedProject {
  id: string
  name: string
  projectNumber: string
  baustelle: string
  datumBeginn?: string
  datumEnde?: string
  status: string
  ansprechpartner?: string
  ansprechpartnerEmail?: string
  telefonnummer?: string
  einsaetze: SubcontractorAssignment[]
  sums: ReturnType<typeof sumAssignments>
  /** Anzahl noch abrechenbarer (bestätigter, nicht abgerechneter) Einsätze */
  billableCount: number
}

export function sanitizeProjectForSubcontractor(
  project: ProjectLike & Record<string, any>,
  companyId: string,
  options: ToAssignmentsOptions
): SanitizedProject {
  const einsaetze = toSubcontractorAssignments(project, companyId, options)
  const sums = sumAssignments(einsaetze)
  return {
    id: String(project.id || project._id || ''),
    name: String(project.name || ''),
    projectNumber: String(project.auftragsnummer || ''),
    baustelle: String(project.baustelle || ''),
    datumBeginn: project.datumBeginn ? String(project.datumBeginn) : undefined,
    datumEnde: project.datumEnde ? String(project.datumEnde) : undefined,
    status: String(project.status || ''),
    ansprechpartner: project.ansprechpartner ? String(project.ansprechpartner) : undefined,
    ansprechpartnerEmail: project.ansprechpartnerEmail ? String(project.ansprechpartnerEmail) : undefined,
    telefonnummer: project.telefonnummer ? String(project.telefonnummer) : undefined,
    einsaetze,
    sums,
    billableCount: einsaetze.filter((a) => a.status === 'bestaetigt').length,
  }
}

/**
 * Prüft, ob ein Projekt überhaupt Einsätze des Subunternehmens enthält.
 * Nur solche Projekte dürfen im Portal sichtbar sein.
 */
export function projectBelongsToCompany(project: ProjectLike, companyId: string): boolean {
  const zeiten = project.mitarbeiterZeiten || {}
  for (const entries of Object.values(zeiten)) {
    if (!Array.isArray(entries)) continue
    for (const entry of entries) {
      if (entry?.isExternal && String(entry.externalCompanyId || '') === String(companyId)) {
        return true
      }
    }
  }
  return false
}
