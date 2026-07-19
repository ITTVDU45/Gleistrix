import mongoose from 'mongoose'
import ReceivedInvoice from '@/lib/models/ReceivedInvoice'
import {
  findProjectsForCompany,
  getInvoicedKeysForCompany,
  todayIsoDate,
} from '@/lib/subunternehmen/queries'
import { toSubcontractorAssignments } from '@/lib/subunternehmen/assignments'
import { findDuplicateAssignments, BLOCKING_INVOICE_STATUSES } from '@/lib/subunternehmen/invoiceTotals'
import type { InvoiceLineItem, SubcontractorAssignment } from '@/types/subunternehmen'

export interface LineItemValidationResult {
  /** Harte Fehler – Rechnung darf so nicht eingereicht werden */
  errors: string[]
  /** Kennzeichnungen/Abweichungen – werden gespeichert und angezeigt */
  warnings: string[]
}

/** Alle Einsätze des Subunternehmens als Map assignmentKey → Einsatz. */
export async function getAssignmentMapForCompany(
  companyId: mongoose.Types.ObjectId | string,
  excludeInvoiceId?: string
): Promise<Map<string, SubcontractorAssignment>> {
  const [projects, invoiced] = await Promise.all([
    findProjectsForCompany(companyId),
    getInvoicedKeysForCompany(companyId, excludeInvoiceId),
  ])
  const today = todayIsoDate()
  const map = new Map<string, SubcontractorAssignment>()
  for (const project of projects) {
    for (const a of toSubcontractorAssignments(project, String(companyId), {
      today,
      invoicedKeys: invoiced.invoicedKeys,
      invoiceNumbersByKey: invoiced.invoiceNumbersByKey,
    })) {
      map.set(a.assignmentKey, a)
    }
  }
  return map
}

/**
 * Validiert Rechnungspositionen gegen die disponierten/bestätigten Einsätze.
 * - fremde/unbekannte assignmentKeys → Fehler (IDOR-Schutz)
 * - doppelt verwendete Einsätze → Fehler
 * - nicht bestätigte Stunden / Überschreitungen / Abweichungen → Warnung
 */
export async function validateLineItemsAgainstAssignments(
  companyId: mongoose.Types.ObjectId | string,
  lineItems: InvoiceLineItem[],
  excludeInvoiceId?: string
): Promise<LineItemValidationResult> {
  const errors: string[] = []
  const warnings: string[] = []

  const withKeys = lineItems.filter((li) => li.assignmentKey)
  if (withKeys.length === 0) return { errors, warnings }

  const assignmentMap = await getAssignmentMapForCompany(companyId, excludeInvoiceId)

  // Duplikate innerhalb der Rechnung und gegen andere Rechnungen
  const otherInvoices = await ReceivedInvoice.find({
    subcontractorCompanyId: companyId,
    status: { $in: [...BLOCKING_INVOICE_STATUSES] },
    ...(excludeInvoiceId && mongoose.isValidObjectId(excludeInvoiceId)
      ? { _id: { $ne: new mongoose.Types.ObjectId(excludeInvoiceId) } }
      : {}),
  })
    .select('status invoiceNumber lineItems.assignmentKey')
    .lean()

  const dup = findDuplicateAssignments(
    withKeys,
    otherInvoices as unknown as Array<{ status: string; invoiceNumber: string; lineItems: Array<{ assignmentKey?: string }> }>
  )
  for (const key of dup.duplicatesInInvoice) {
    errors.push(`Einsatz mehrfach in dieser Rechnung enthalten: ${key}`)
  }
  for (const hit of dup.alreadyInvoiced) {
    errors.push(`Einsatz bereits in Rechnung ${hit.invoiceNumber} abgerechnet: ${hit.assignmentKey}`)
  }

  for (const li of withKeys) {
    const assignment = assignmentMap.get(li.assignmentKey as string)
    if (!assignment) {
      errors.push(`Einsatz nicht gefunden oder nicht Ihrem Unternehmen zugeordnet: ${li.assignmentKey}`)
      continue
    }
    if (assignment.status === 'geplant') {
      warnings.push(
        `Position "${li.description}": Einsatz am ${assignment.day} ist noch nicht durchgeführt/bestätigt`
      )
    } else if (assignment.status === 'durchgefuehrt') {
      warnings.push(`Position "${li.description}": Stunden für ${assignment.day} sind noch nicht bestätigt`)
    }
    if (li.type === 'HOURS' && li.unit === 'h' && li.quantity > assignment.stundenTotal + 0.01) {
      warnings.push(
        `Position "${li.description}": ${li.quantity} h übersteigt die bestätigten ${assignment.stundenTotal} h`
      )
    }
    if (li.type === 'SURCHARGE' && li.unit === 'h') {
      const maxSurcharge =
        assignment.nachtzulageTotal + assignment.sonntagsstundenTotal + assignment.feiertagTotal + assignment.extraTotal
      if (li.quantity > maxSurcharge + 0.01) {
        warnings.push(
          `Position "${li.description}": Zuschlagsstunden (${li.quantity} h) übersteigen die erfassten Zuschläge (${maxSurcharge} h)`
        )
      }
    }
  }

  return { errors, warnings }
}

/** Prüft die Eindeutigkeit der Rechnungsnummer je Subunternehmen. */
export async function isInvoiceNumberTaken(
  companyId: mongoose.Types.ObjectId | string,
  invoiceNumber: string,
  excludeInvoiceId?: string
): Promise<boolean> {
  const query: Record<string, unknown> = {
    subcontractorCompanyId: companyId,
    invoiceNumber,
    status: { $ne: 'CANCELLED' },
  }
  if (excludeInvoiceId && mongoose.isValidObjectId(excludeInvoiceId)) {
    query._id = { $ne: new mongoose.Types.ObjectId(excludeInvoiceId) }
  }
  const existing = await ReceivedInvoice.findOne(query).select('_id').lean()
  return Boolean(existing)
}

/** Nächste freie Rechnungsnummer für das Subunternehmen vorschlagen. */
export async function nextInvoiceSequence(
  companyId: mongoose.Types.ObjectId | string,
  year: number
): Promise<number> {
  const count = await ReceivedInvoice.countDocuments({
    subcontractorCompanyId: companyId,
    invoiceDate: {
      $gte: new Date(Date.UTC(year, 0, 1)),
      $lt: new Date(Date.UTC(year + 1, 0, 1)),
    },
  })
  return count + 1
}
