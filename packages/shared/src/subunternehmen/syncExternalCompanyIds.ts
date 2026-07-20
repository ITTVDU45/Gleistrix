import { Project } from '@/lib/models/Project'
import {
  computeExternalCompanyIds,
  externalCompanyIdsEqual,
} from '@/lib/timeEntry/externalCompanies'
import { logger } from '@/lib/logger'

/**
 * Hält `Project.externalCompanyIds` nach findByIdAndUpdate-Schreibpfaden
 * aktuell (diese umgehen den pre-save-Hook). No-op, wenn bereits konsistent.
 * Best effort: ein Sync-Fehler darf den fachlichen Vorgang nicht abbrechen.
 */
export async function syncProjectExternalCompanyIds(project: {
  _id: unknown
  mitarbeiterZeiten?: Record<string, unknown>
  externalCompanyIds?: unknown
}): Promise<void> {
  try {
    const computed = computeExternalCompanyIds(project.mitarbeiterZeiten)
    if (externalCompanyIdsEqual(project.externalCompanyIds, computed)) return
    await Project.updateOne({ _id: project._id }, { $set: { externalCompanyIds: computed } })
  } catch (error) {
    logger.warn('externalCompanyIds konnten nicht synchronisiert werden', error)
  }
}
