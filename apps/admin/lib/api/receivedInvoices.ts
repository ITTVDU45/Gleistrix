import { getJSON, postJSON } from '@/lib/http/apiClient'
import type { ReceivedInvoiceDto, SubcontractorAssignment } from '@/types/subunternehmen'

export interface AdminReceivedInvoice extends ReceivedInvoiceDto {
  subcontractorCompanyName?: string
  internalNotes?: Array<{ id: string; text: string; createdByName?: string; createdAt?: string }>
}

export interface ReceivedInvoiceFilters {
  status?: string
  companyId?: string
  projectId?: string
  search?: string
  dateFrom?: string
  dateTo?: string
  dueFrom?: string
  dueTo?: string
  minAmount?: string
  maxAmount?: string
  page?: number
  limit?: number
  sort?: string
  dir?: 'asc' | 'desc'
}

export interface ReceivedInvoiceDetail {
  invoice: AdminReceivedInvoice
  company: Record<string, unknown> | null
  documents: Array<{
    id: string
    name: string
    type: string
    contentType?: string
    size?: number
    source: string
    createdAt?: string
  }>
  comparison: {
    assignments: Array<SubcontractorAssignment & { referencedInInvoice: boolean }>
    deviations: string[]
  }
}

export type ReceivedInvoiceAction =
  | 'START_REVIEW'
  | 'REQUEST_CHANGES'
  | 'REJECT'
  | 'APPROVE'
  | 'SCHEDULE_PAYMENT'
  | 'MARK_PAID'

export const ReceivedInvoicesApi = {
  list: (filters: ReceivedInvoiceFilters = {}) => {
    const query = new URLSearchParams()
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== '' && value !== null) query.set(key, String(value))
    }
    const qs = query.toString()
    return getJSON<{ invoices: AdminReceivedInvoice[]; meta: { total: number; page: number; limit: number } }>(
      `/api/abbrechnung/received-invoices${qs ? `?${qs}` : ''}`
    )
  },
  detail: (id: string) => getJSON<ReceivedInvoiceDetail>(`/api/abbrechnung/received-invoices/${id}`),
  changeStatus: (id: string, action: ReceivedInvoiceAction, message?: string) =>
    postJSON<{ invoice: AdminReceivedInvoice; error?: string }>(
      `/api/abbrechnung/received-invoices/${id}/status`,
      { action, message },
      'received-invoices:status'
    ),
  addNote: (id: string, text: string) =>
    postJSON<{ invoice: AdminReceivedInvoice; error?: string }>(
      `/api/abbrechnung/received-invoices/${id}/notes`,
      { text },
      'received-invoices:note'
    ),
  documentUrl: (invoiceId: string, docId: string) =>
    `/api/abbrechnung/received-invoices/${invoiceId}/documents/${docId}`,
}
