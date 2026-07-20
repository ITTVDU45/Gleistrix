/**
 * Materialisierung der Subunternehmen-Zuordnung eines Projekts.
 *
 * `Project.mitarbeiterZeiten` ist ein datums-keyed Mixed-Objekt und damit
 * nicht indizierbar. Für die Portal-Abfrage „alle Projekte eines
 * Subunternehmens" wird deshalb die Menge aller `externalCompanyId`-Werte in
 * das indizierte Feld `Project.externalCompanyIds` materialisiert und bei
 * jedem Schreibpfad synchron gehalten (pre-save-Hook + explizite Syncs für
 * findByIdAndUpdate-Pfade).
 */

export interface TimeEntryWithExternal {
  isExternal?: boolean
  externalCompanyId?: string
}

/** Sortierte, eindeutige Liste aller Subunternehmen-IDs in der Disposition. */
export function computeExternalCompanyIds(
  mitarbeiterZeiten: Record<string, unknown> | null | undefined
): string[] {
  const ids = new Set<string>()
  if (!mitarbeiterZeiten || typeof mitarbeiterZeiten !== 'object') return []
  for (const entries of Object.values(mitarbeiterZeiten)) {
    if (!Array.isArray(entries)) continue
    for (const entry of entries as TimeEntryWithExternal[]) {
      if (!entry || typeof entry !== 'object') continue
      if (entry.isExternal && entry.externalCompanyId) {
        const id = String(entry.externalCompanyId).trim()
        if (id) ids.add(id)
      }
    }
  }
  return Array.from(ids).sort()
}

/** Vergleicht bestehende und neu berechnete IDs (Reihenfolge-unabhängig). */
export function externalCompanyIdsEqual(
  current: unknown,
  computed: string[]
): boolean {
  if (!Array.isArray(current) || current.length !== computed.length) return false
  const currentSorted = current.map((v) => String(v)).sort()
  return currentSorted.every((v, i) => v === computed[i])
}
