import type { InvoiceLineItem, InvoiceLineType, InvoiceUnit } from '@/types/subunternehmen'

/** Kaufmännische Rundung auf 2 Nachkommastellen */
export const round2 = (value: number): number => {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.round((n + Number.EPSILON) * 100) / 100
}

export interface LineItemInput {
  id?: string
  type: InvoiceLineType
  description: string
  projectId?: string
  assignmentKey?: string
  serviceDate?: string
  quantity: number
  unit: InvoiceUnit
  unitPrice: number
  vatRate: number
  surchargeType?: string
  surchargePercentage?: number
}

/**
 * Berechnet eine Rechnungsposition vollständig serverseitig.
 * Client-seitig gelieferte Netto-/Steuer-/Bruttowerte werden ignoriert.
 */
export function computeLineItem(input: LineItemInput, fallbackId: string): InvoiceLineItem {
  const quantity = round2(Number(input.quantity) || 0)
  const unitPrice = round2(Number(input.unitPrice) || 0)
  const vatRate = Number(input.vatRate)
  const safeVatRate = Number.isFinite(vatRate) && vatRate >= 0 && vatRate <= 100 ? vatRate : 19

  const netAmount = round2(quantity * unitPrice)
  const vatAmount = round2(netAmount * (safeVatRate / 100))
  const grossAmount = round2(netAmount + vatAmount)

  return {
    id: input.id || fallbackId,
    type: input.type,
    description: String(input.description || '').trim(),
    projectId: input.projectId || undefined,
    assignmentKey: input.assignmentKey || undefined,
    serviceDate: input.serviceDate || undefined,
    quantity,
    unit: input.unit,
    unitPrice,
    netAmount,
    vatRate: safeVatRate,
    vatAmount,
    grossAmount,
    surchargeType: input.surchargeType || undefined,
    surchargePercentage:
      input.surchargePercentage !== undefined && Number.isFinite(Number(input.surchargePercentage))
        ? Number(input.surchargePercentage)
        : undefined,
  }
}

export interface InvoiceTotals {
  subtotalNet: number
  totalVat: number
  totalGross: number
}

export function computeInvoiceTotals(lineItems: InvoiceLineItem[]): InvoiceTotals {
  const subtotalNet = round2(lineItems.reduce((sum, li) => sum + (li.netAmount || 0), 0))
  const totalVat = round2(lineItems.reduce((sum, li) => sum + (li.vatAmount || 0), 0))
  const totalGross = round2(subtotalNet + totalVat)
  return { subtotalNet, totalVat, totalGross }
}

/** Fälligkeitsdatum aus Rechnungsdatum + Zahlungsziel */
export function computeDueDate(invoiceDate: Date, paymentTermDays?: number): Date | undefined {
  if (!paymentTermDays || paymentTermDays <= 0) return undefined
  const due = new Date(invoiceDate.getTime())
  due.setDate(due.getDate() + Math.floor(paymentTermDays))
  return due
}

export interface DuplicateCheckInvoiceLike {
  status: string
  invoiceNumber: string
  lineItems: Array<{ assignmentKey?: string }>
}

/** Nicht-stornierte/abgelehnte Rechnungen blockieren die erneute Abrechnung eines Einsatzes. */
export const BLOCKING_INVOICE_STATUSES = [
  'DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'CHANGES_REQUESTED',
  'APPROVED', 'SCHEDULED_FOR_PAYMENT', 'PAID',
] as const

/**
 * Findet assignmentKeys, die bereits in anderen (blockierenden) Rechnungen
 * verwendet werden, sowie Duplikate innerhalb der neuen Positionsliste.
 */
export function findDuplicateAssignments(
  lineItems: Array<{ assignmentKey?: string }>,
  otherInvoices: DuplicateCheckInvoiceLike[]
): { duplicatesInInvoice: string[]; alreadyInvoiced: Array<{ assignmentKey: string; invoiceNumber: string }> } {
  const seen = new Set<string>()
  const duplicatesInInvoice: string[] = []
  for (const li of lineItems) {
    const key = li.assignmentKey
    if (!key) continue
    if (seen.has(key)) duplicatesInInvoice.push(key)
    seen.add(key)
  }

  const alreadyInvoiced: Array<{ assignmentKey: string; invoiceNumber: string }> = []
  const blocking = new Set<string>(BLOCKING_INVOICE_STATUSES)
  for (const inv of otherInvoices) {
    if (!blocking.has(inv.status)) continue
    for (const li of inv.lineItems) {
      if (li.assignmentKey && seen.has(li.assignmentKey)) {
        alreadyInvoiced.push({ assignmentKey: li.assignmentKey, invoiceNumber: inv.invoiceNumber })
      }
    }
  }
  return { duplicatesInInvoice, alreadyInvoiced }
}

/** Nächste Rechnungsnummer aus Präfix + Jahr + laufender Nummer */
export function suggestInvoiceNumber(prefix: string | undefined, year: number, sequence: number): string {
  const cleanPrefix = (prefix || 'RE').replace(/[^A-Za-z0-9-]/g, '').slice(0, 12) || 'RE'
  return `${cleanPrefix}-${year}-${String(sequence).padStart(4, '0')}`
}
