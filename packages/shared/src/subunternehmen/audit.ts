import mongoose from 'mongoose'
import ActivityLog from '@/lib/models/ActivityLog'
import { logger } from '@/lib/logger'

export interface SubcontractorAuditInput {
  actionType: string
  description: string
  userId?: mongoose.Types.ObjectId | string
  userName: string
  userRole: string
  entityId?: mongoose.Types.ObjectId | string
  subcontractorCompanyId?: mongoose.Types.ObjectId | string
  before?: unknown
  after?: unknown
  /** Nur unkritische Metadaten – keine Beträge im Detail, keine Bankdaten */
  meta?: Record<string, unknown>
}

/**
 * Audit-Eintrag für Subunternehmen-Aktionen. Fehler beim Logging dürfen den
 * fachlichen Vorgang nie abbrechen (best effort, wie im Bestand).
 */
export async function logSubcontractorActivity(input: SubcontractorAuditInput): Promise<void> {
  try {
    const userId =
      input.userId && mongoose.isValidObjectId(String(input.userId))
        ? new mongoose.Types.ObjectId(String(input.userId))
        : undefined
    const entityId =
      input.entityId && mongoose.isValidObjectId(String(input.entityId))
        ? new mongoose.Types.ObjectId(String(input.entityId))
        : undefined

    await ActivityLog.create({
      timestamp: new Date(),
      actionType: input.actionType,
      module: 'subcontractor',
      performedBy: {
        userId,
        name: input.userName || 'Unbekannt',
        role: input.userRole || 'user',
      },
      details: {
        entityId,
        description: input.description,
        before: input.before,
        after: input.after,
        context: {
          ...(input.meta || {}),
          ...(input.subcontractorCompanyId
            ? { subcontractorCompanyId: String(input.subcontractorCompanyId) }
            : {}),
        },
      },
    })
  } catch (error) {
    logger.warn('Subunternehmen-Audit-Log fehlgeschlagen', error)
  }
}
