import { getJSON, postJSON, putJSON, delJSON } from '@/lib/http/apiClient'
import type {
  ReceivedInvoiceDto,
  SubcontractorAssignment,
  SubcontractorDocumentDto,
  SubcontractorPermission,
  SubcontractorRole,
} from '@/types/subunternehmen'

export interface PortalProjectListItem {
  id: string
  name: string
  projectNumber: string
  baustelle: string
  datumBeginn?: string
  datumEnde?: string
  status: string
  einsatzCount: number
  mitarbeiterCount: number
  stundenGeplant: number
  stundenBestaetigt: number
  billableCount: number
}

export interface PortalProjectDetail {
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
  sums: {
    stunden: number
    fahrtstunden: number
    nachtzulage: number
    sonntagsstunden: number
    feiertag: number
    extra: number
    einsaetze: number
    mitarbeiter: number
  }
  billableCount: number
}

export interface PortalCompany {
  id: string
  name: string
  legalName: string
  employeeCount?: number
  address: string
  billingAddress: { street: string; postalCode: string; city: string; country: string }
  phone: string
  email: string
  contactName: string
  contactEmail: string
  contactPhone: string
  taxNumber: string
  vatId: string
  iban: string
  bic: string
  bankName: string
  defaultPaymentTermDays?: number
  defaultVatRate?: number
  invoiceNumberPrefix: string
  status: string
  /** Vereinbarte Sätze – im Portal nur lesend (Pflege erfolgt durch die Disposition) */
  functionRates: Array<{ funktion: string; hourlyRate: number }>
  surchargeRates: { nachtProzent?: number; sonntagProzent?: number; feiertagProzent?: number }
}

export interface PortalDashboard {
  companyName: string
  activeProjects: number
  totalProjects: number
  upcomingAssignments: SubcontractorAssignment[]
  billableAssignmentsCount: number
  billableHours: number
  invoices: {
    drafts: number
    submitted: number
    changesRequested: number
    approved: number
    paid: number
    recent: Array<{
      id: string
      invoiceNumber: string
      status: string
      totalGross: number
      changeRequestMessage?: string
    }>
  }
  recentDocuments: Array<{ id: string; name: string; type: string; source: string; createdAt?: string }>
  missingForInvoicing: string[]
}

export interface InvoiceDraftPayload {
  invoiceNumber?: string
  invoiceDate?: string
  servicePeriodStart?: string
  servicePeriodEnd?: string
  orderNumber?: string
  purchaseOrderNumber?: string
  paymentTermDays?: number
  remarks?: string
  lineItems: Array<{
    id?: string
    type: string
    description: string
    projectId?: string
    assignmentKey?: string
    serviceDate?: string
    quantity: number
    unit: string
    unitPrice: number
    vatRate: number
    surchargeType?: string
    surchargePercentage?: number
  }>
}

export const SubPortalApi = {
  dashboard: () => getJSON<{ dashboard: PortalDashboard }>('/api/subunternehmen/dashboard'),
  projects: () => getJSON<{ projects: PortalProjectListItem[] }>('/api/subunternehmen/projects'),
  project: (id: string) => getJSON<{ project: PortalProjectDetail }>(`/api/subunternehmen/projects/${id}`),
  assignments: () =>
    getJSON<{ assignments: SubcontractorAssignment[]; sums: PortalProjectDetail['sums'] }>(
      '/api/subunternehmen/assignments'
    ),
  company: () =>
    getJSON<{
      company: PortalCompany
      missingForInvoicing: string[]
      membershipRole: SubcontractorRole
      permissions: SubcontractorPermission[]
    }>('/api/subunternehmen/company'),
  updateCompany: (data: Partial<PortalCompany>) =>
    putJSON<{ company: PortalCompany; missingForInvoicing: string[]; error?: string }>(
      '/api/subunternehmen/company',
      data as Record<string, unknown>,
      'sub:company-update'
    ),

  invoices: () => getJSON<{ invoices: ReceivedInvoiceDto[] }>('/api/subunternehmen/invoices'),
  invoicePrefill: (params?: { projectId?: string; keys?: string[] }) => {
    const query = new URLSearchParams()
    if (params?.projectId) query.set('projectId', params.projectId)
    if (params?.keys?.length) query.set('keys', params.keys.join(','))
    const qs = query.toString()
    return getJSON<{
      assignments: Array<SubcontractorAssignment & { hourlyRate?: number }>
      lineItems: InvoiceDraftPayload['lineItems']
      defaultVatRate: number
      defaultPaymentTermDays?: number
      /** Funktionen, für die im Admin-Bereich noch kein Stundensatz hinterlegt ist */
      missingRates: string[]
    }>(`/api/subunternehmen/invoices/prefill${qs ? `?${qs}` : ''}`)
  },
  invoice: (id: string) => getJSON<{ invoice: ReceivedInvoiceDto }>(`/api/subunternehmen/invoices/${id}`),
  createInvoice: (data: InvoiceDraftPayload) =>
    postJSON<{ invoice: ReceivedInvoiceDto; warnings?: string[]; error?: string }>(
      '/api/subunternehmen/invoices',
      data as unknown as Record<string, unknown>,
      'sub:invoice-create'
    ),
  updateInvoice: (id: string, data: InvoiceDraftPayload) =>
    putJSON<{ invoice: ReceivedInvoiceDto; warnings?: string[]; error?: string }>(
      `/api/subunternehmen/invoices/${id}`,
      data as unknown as Record<string, unknown>,
      'sub:invoice-update'
    ),
  deleteInvoice: (id: string) =>
    delJSON<{ message?: string; error?: string }>(`/api/subunternehmen/invoices/${id}`, 'sub:invoice-delete'),
  submitInvoice: (id: string) =>
    postJSON<{ invoice: ReceivedInvoiceDto; error?: string }>(
      `/api/subunternehmen/invoices/${id}/submit`,
      {},
      'sub:invoice-submit'
    ),
  reviseInvoice: (id: string) =>
    postJSON<{ invoice: ReceivedInvoiceDto; error?: string }>(
      `/api/subunternehmen/invoices/${id}/revision`,
      {},
      'sub:invoice-revision'
    ),

  documents: (params?: { projectId?: string }) => {
    const q = params?.projectId ? `?projectId=${encodeURIComponent(params.projectId)}` : ''
    return getJSON<{ documents: SubcontractorDocumentDto[] }>(`/api/subunternehmen/documents${q}`)
  },
  documentDownloadUrl: (id: string) => `/api/subunternehmen/documents/${id}`,
  deleteDocument: (id: string) =>
    delJSON<{ message?: string; error?: string }>(`/api/subunternehmen/documents/${id}`, 'sub:document-delete'),
}
