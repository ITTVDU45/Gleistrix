import { z } from 'zod'
import { randomUUID } from 'crypto'
import {
  computeLineItem,
  computeInvoiceTotals,
  computeDueDate,
  type LineItemInput,
} from '@/lib/subunternehmen/invoiceTotals'
import type { InvoiceLineItem } from '@/types/subunternehmen'

export const lineItemSchema = z.object({
  id: z.string().optional(),
  type: z.enum(['HOURS', 'EMPLOYEES', 'SHIFT', 'SURCHARGE', 'QUANTITY', 'FLAT_RATE', 'MATERIAL', 'TRAVEL', 'CUSTOM']),
  description: z.string().min(1).max(500),
  projectId: z.string().optional(),
  assignmentKey: z.string().max(300).optional(),
  serviceDate: z.string().optional(),
  quantity: z.number().min(0).max(1_000_000),
  unit: z.enum(['h', 'Stück', 'Tag', 'Schicht', 'km', 'pauschal']),
  unitPrice: z.number().min(0).max(10_000_000),
  vatRate: z.number().min(0).max(100),
  surchargeType: z.string().max(100).optional(),
  surchargePercentage: z.number().min(0).max(1000).optional(),
})

export const invoiceDraftSchema = z.object({
  invoiceNumber: z.string().min(1).max(60).optional(),
  invoiceDate: z.string().optional(),
  servicePeriodStart: z.string().optional(),
  servicePeriodEnd: z.string().optional(),
  orderNumber: z.string().max(100).optional(),
  purchaseOrderNumber: z.string().max(100).optional(),
  paymentTermDays: z.number().int().min(0).max(365).optional(),
  remarks: z.string().max(2000).optional(),
  lineItems: z.array(lineItemSchema).max(500),
})

export type InvoiceDraftInput = z.infer<typeof invoiceDraftSchema>

const parseDate = (value?: string): Date | undefined => {
  if (!value) return undefined
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? undefined : d
}

export interface ComputedDraft {
  invoiceDate: Date
  servicePeriodStart?: Date
  servicePeriodEnd?: Date
  lineItems: InvoiceLineItem[]
  subtotalNet: number
  totalVat: number
  totalGross: number
  paymentTermDays?: number
  dueDate?: Date
  projectIds: string[]
}

/**
 * Berechnet alle abgeleiteten Rechnungswerte serverseitig neu.
 * Client-gelieferte Summen werden grundsätzlich verworfen.
 */
export function computeDraft(input: InvoiceDraftInput, defaultVatRate?: number): ComputedDraft {
  const lineItems = input.lineItems.map((li, idx) =>
    computeLineItem(
      {
        ...li,
        vatRate: Number.isFinite(li.vatRate) ? li.vatRate : defaultVatRate ?? 19,
      } as LineItemInput,
      li.id || randomUUID().slice(0, 8) + `-${idx}`
    )
  )
  const totals = computeInvoiceTotals(lineItems)
  const invoiceDate = parseDate(input.invoiceDate) || new Date()

  // Leistungszeitraum: explizit oder aus den Positionsdaten ableiten
  const serviceDates = lineItems
    .map((li) => li.serviceDate)
    .filter((d): d is string => Boolean(d))
    .sort()
  const servicePeriodStart = parseDate(input.servicePeriodStart) || parseDate(serviceDates[0])
  const servicePeriodEnd = parseDate(input.servicePeriodEnd) || parseDate(serviceDates[serviceDates.length - 1])

  const projectIds = Array.from(
    new Set(lineItems.map((li) => li.projectId).filter((p): p is string => Boolean(p)))
  )

  return {
    invoiceDate,
    servicePeriodStart,
    servicePeriodEnd,
    lineItems,
    ...totals,
    paymentTermDays: input.paymentTermDays,
    dueDate: computeDueDate(invoiceDate, input.paymentTermDays),
    projectIds,
  }
}
