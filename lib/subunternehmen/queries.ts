import mongoose from 'mongoose'
import { Project } from '@/lib/models/Project'
import ReceivedInvoice from '@/lib/models/ReceivedInvoice'
import { BLOCKING_INVOICE_STATUSES } from '@/lib/subunternehmen/invoiceTotals'
import { projectBelongsToCompany } from '@/lib/subunternehmen/sanitizeProject'
import type { ProjectLike } from '@/lib/subunternehmen/assignments'

/** Felder, die für die Portal-Aufbereitung benötigt werden (Whitelist-Select). */
const PORTAL_PROJECT_FIELDS =
  'name auftragsnummer baustelle status datumBeginn datumEnde ansprechpartner ansprechpartnerEmail telefonnummer mitarbeiterZeiten abgerechneteTage'

/**
 * Alle Projekte, in denen das Subunternehmen über die Projektdisposition
 * eingeplant ist. Die Disposition bleibt die primäre Datenquelle –
 * es wird keine redundante Kopie gepflegt.
 *
 * Die Abfrage läuft über das materialisierte, B-Tree-indizierte Feld
 * `externalCompanyIds` (gepflegt via pre-save-Hook bzw.
 * syncProjectExternalCompanyIds). Altbestände ohne das Feld werden über den
 * $exists-Fallback mitgelesen, bis das Migrationsskript sie backfillt.
 * Defense-in-Depth: das Ergebnis wird zusätzlich in Node über
 * `projectBelongsToCompany` gegen die echte Disposition verifiziert.
 */
export async function findProjectsForCompany(
  companyId: mongoose.Types.ObjectId | string
): Promise<Array<ProjectLike & Record<string, any>>> {
  const companyIdStr = String(companyId)
  const projects = await Project.find({
    $or: [
      { externalCompanyIds: companyIdStr },
      { externalCompanyIds: { $exists: false } },
    ],
  })
    .select(PORTAL_PROJECT_FIELDS)
    .lean()

  return (projects as Array<ProjectLike & Record<string, any>>).filter((p) =>
    projectBelongsToCompany(p, companyIdStr)
  )
}

export async function findProjectForCompany(
  projectId: string,
  companyId: mongoose.Types.ObjectId | string
): Promise<(ProjectLike & Record<string, any>) | null> {
  if (!mongoose.isValidObjectId(projectId)) return null
  const project = await Project.findById(projectId).select(PORTAL_PROJECT_FIELDS).lean()
  if (!project) return null
  // IDOR-Schutz: Projekt nur liefern, wenn das Subunternehmen disponiert ist
  if (!projectBelongsToCompany(project as ProjectLike, String(companyId))) return null
  return project as ProjectLike & Record<string, any>
}

export interface InvoicedKeysResult {
  invoicedKeys: Set<string>
  invoiceNumbersByKey: Map<string, string[]>
}

/**
 * Alle assignmentKeys, die in nicht-stornierten Rechnungen des Subunternehmens
 * verwendet werden (Basis für Doppelabrechnungs-Erkennung und Statusanzeige).
 */
export async function getInvoicedKeysForCompany(
  companyId: mongoose.Types.ObjectId | string,
  excludeInvoiceId?: string
): Promise<InvoicedKeysResult> {
  const query: Record<string, unknown> = {
    subcontractorCompanyId: companyId,
    status: { $in: [...BLOCKING_INVOICE_STATUSES] },
  }
  if (excludeInvoiceId && mongoose.isValidObjectId(excludeInvoiceId)) {
    query._id = { $ne: new mongoose.Types.ObjectId(excludeInvoiceId) }
  }
  const invoices = await ReceivedInvoice.find(query)
    .select('invoiceNumber lineItems.assignmentKey')
    .lean()

  const invoicedKeys = new Set<string>()
  const invoiceNumbersByKey = new Map<string, string[]>()
  for (const inv of invoices as unknown as Array<{ invoiceNumber: string; lineItems?: Array<{ assignmentKey?: string }> }>) {
    for (const li of inv.lineItems || []) {
      if (!li.assignmentKey) continue
      invoicedKeys.add(li.assignmentKey)
      const list = invoiceNumbersByKey.get(li.assignmentKey) || []
      if (!list.includes(inv.invoiceNumber)) list.push(inv.invoiceNumber)
      invoiceNumbersByKey.set(li.assignmentKey, list)
    }
  }
  return { invoicedKeys, invoiceNumbersByKey }
}

export const todayIsoDate = (): string => new Date().toISOString().slice(0, 10)

/** Whitelist-Serialisierung der eigenen Unternehmensdaten (ohne interne Notizen). */
export function serializeCompanyForPortal(company: Record<string, any>) {
  return {
    id: String(company._id ?? company.id),
    name: String(company.name || ''),
    legalName: company.legalName || '',
    employeeCount: company.employeeCount ?? undefined,
    address: company.address || '',
    billingAddress: {
      street: company.billingAddress?.street || '',
      postalCode: company.billingAddress?.postalCode || '',
      city: company.billingAddress?.city || '',
      country: company.billingAddress?.country || '',
    },
    phone: company.phone || '',
    email: company.email || '',
    contactName: company.contactName || '',
    contactEmail: company.contactEmail || '',
    contactPhone: company.contactPhone || '',
    taxNumber: company.taxNumber || '',
    vatId: company.vatId || '',
    iban: company.iban || '',
    bic: company.bic || '',
    bankName: company.bankName || '',
    defaultPaymentTermDays: company.defaultPaymentTermDays ?? undefined,
    defaultVatRate: company.defaultVatRate ?? undefined,
    invoiceNumberPrefix: company.invoiceNumberPrefix || '',
    status: company.status || 'active',
    // Vereinbarte Sätze (im Portal nur lesend; Pflege erfolgt intern)
    functionRates: Array.isArray(company.functionRates)
      ? company.functionRates.map((r: { funktion?: string; hourlyRate?: number }) => ({
          funktion: String(r.funktion || ''),
          hourlyRate: Number(r.hourlyRate) || 0,
        }))
      : [],
    surchargeRates: {
      nachtProzent: company.surchargeRates?.nachtProzent ?? undefined,
      sonntagProzent: company.surchargeRates?.sonntagProzent ?? undefined,
      feiertagProzent: company.surchargeRates?.feiertagProzent ?? undefined,
    },
  }
}

/** Pflichtangaben, die vor dem Einreichen einer Rechnung vorliegen müssen. */
export function missingCompanyFieldsForInvoicing(company: Record<string, any>): string[] {
  const missing: string[] = []
  if (!company.billingAddress?.street || !company.billingAddress?.postalCode || !company.billingAddress?.city) {
    missing.push('Rechnungsanschrift')
  }
  if (!company.iban) missing.push('IBAN')
  if (!company.taxNumber && !company.vatId) missing.push('Steuernummer oder USt-ID')
  return missing
}
