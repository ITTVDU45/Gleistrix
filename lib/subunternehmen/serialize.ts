import type { ReceivedInvoiceDto } from '@/types/subunternehmen'

const toIso = (value: unknown): string | undefined => {
  if (!value) return undefined
  const d = value instanceof Date ? value : new Date(String(value))
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString()
}

/**
 * Serialisiert eine Rechnung für das Subunternehmen-Portal.
 * WICHTIG: `internalNotes` und interne Prüfer-Metadaten werden hier bewusst
 * NICHT übernommen (Whitelist statt Blacklist).
 */
export function serializeInvoiceForPortal(doc: Record<string, any>): ReceivedInvoiceDto {
  return {
    id: String(doc._id ?? doc.id),
    subcontractorCompanyId: String(doc.subcontractorCompanyId),
    createdByUserId: String(doc.createdByUserId),
    invoiceNumber: String(doc.invoiceNumber || ''),
    invoiceDate: toIso(doc.invoiceDate) || '',
    servicePeriodStart: toIso(doc.servicePeriodStart),
    servicePeriodEnd: toIso(doc.servicePeriodEnd),
    projectIds: (doc.projectIds || []).map((p: unknown) => String(p)),
    orderNumber: doc.orderNumber || undefined,
    purchaseOrderNumber: doc.purchaseOrderNumber || undefined,
    lineItems: (doc.lineItems || []).map((li: Record<string, any>) => ({
      id: String(li.id),
      type: li.type,
      description: String(li.description || ''),
      projectId: li.projectId || undefined,
      assignmentKey: li.assignmentKey || undefined,
      serviceDate: li.serviceDate || undefined,
      quantity: Number(li.quantity) || 0,
      unit: li.unit,
      unitPrice: Number(li.unitPrice) || 0,
      netAmount: Number(li.netAmount) || 0,
      vatRate: Number(li.vatRate) || 0,
      vatAmount: Number(li.vatAmount) || 0,
      grossAmount: Number(li.grossAmount) || 0,
      surchargeType: li.surchargeType || undefined,
      surchargePercentage:
        li.surchargePercentage !== undefined && li.surchargePercentage !== null
          ? Number(li.surchargePercentage)
          : undefined,
    })),
    subtotalNet: Number(doc.subtotalNet) || 0,
    totalVat: Number(doc.totalVat) || 0,
    totalGross: Number(doc.totalGross) || 0,
    currency: 'EUR',
    paymentTermDays: doc.paymentTermDays ?? undefined,
    dueDate: toIso(doc.dueDate),
    status: doc.status,
    submittedAt: toIso(doc.submittedAt),
    reviewedAt: toIso(doc.reviewedAt),
    approvedAt: toIso(doc.approvedAt),
    paidAt: toIso(doc.paidAt),
    reviewedByUserId: undefined, // interner Prüfer bleibt intern
    rejectionReason: doc.rejectionReason || undefined,
    changeRequestMessage: doc.changeRequestMessage || undefined,
    remarks: doc.remarks || undefined,
    attachmentIds: (doc.attachmentIds || []).map((a: unknown) => String(a)),
    generatedPdfDocumentId: doc.generatedPdfDocumentId ? String(doc.generatedPdfDocumentId) : undefined,
    statusHistory: (doc.statusHistory || []).map((h: Record<string, any>) => ({
      id: String(h.id),
      previousStatus: h.previousStatus || undefined,
      newStatus: h.newStatus,
      message: h.message || undefined,
      changedByUserId: '', // Benutzer-IDs interner Prüfer nicht ins Portal geben
      changedByName: h.changedByName || undefined,
      changedAt: toIso(h.changedAt) || '',
    })),
    warnings: doc.warnings || [],
    version: Number(doc.version) || 1,
    createdAt: toIso(doc.createdAt),
    updatedAt: toIso(doc.updatedAt),
  }
}

/** Serialisierung für den internen Admin-Bereich (inkl. interner Felder). */
export function serializeInvoiceForAdmin(doc: Record<string, any>): ReceivedInvoiceDto & {
  internalNotes: Array<{ id: string; text: string; createdByName?: string; createdAt?: string }>
  reviewedByUserId?: string
} {
  const base = serializeInvoiceForPortal(doc)
  return {
    ...base,
    reviewedByUserId: doc.reviewedByUserId ? String(doc.reviewedByUserId) : undefined,
    statusHistory: (doc.statusHistory || []).map((h: Record<string, any>) => ({
      id: String(h.id),
      previousStatus: h.previousStatus || undefined,
      newStatus: h.newStatus,
      message: h.message || undefined,
      changedByUserId: String(h.changedByUserId || ''),
      changedByName: h.changedByName || undefined,
      changedAt: toIso(h.changedAt) || '',
    })),
    internalNotes: (doc.internalNotes || []).map((n: Record<string, any>) => ({
      id: String(n.id),
      text: String(n.text || ''),
      createdByName: n.createdByName || undefined,
      createdAt: toIso(n.createdAt),
    })),
  }
}
