// ===== SUBUNTERNEHMEN-PORTAL TYPEN =====

/** Rollen innerhalb eines Subunternehmens (Membership-Ebene) */
export type SubcontractorRole = 'SUBCONTRACTOR_OWNER' | 'SUBCONTRACTOR_USER'

export type SubcontractorMembershipStatus = 'invited' | 'active' | 'disabled'

export type SubcompanyStatus = 'active' | 'inactive' | 'blocked'

/** Granulare Permissions für das Subunternehmen-Portal */
export type SubcontractorPermission =
  | 'subcontractor.projects.read'
  | 'subcontractor.assignments.read'
  | 'subcontractor.documents.read'
  | 'subcontractor.documents.upload'
  | 'subcontractor.invoices.read'
  | 'subcontractor.invoices.create'
  | 'subcontractor.invoices.submit'
  | 'subcontractor.company.update'

export interface SubcontractorMembershipDto {
  id: string
  subcontractorCompanyId: string
  userId: string
  role: SubcontractorRole
  permissions: SubcontractorPermission[]
  status: SubcontractorMembershipStatus
  invitedByUserId?: string
  invitedAt?: string
  acceptedAt?: string
  createdAt?: string
  updatedAt?: string
}

// ===== PREISE JE FUNKTION =====

/** Vereinbarter Stundensatz je Funktion (z. B. SIPO, Bahnerder) */
export interface SubcompanyFunctionRate {
  funktion: string
  hourlyRate: number
}

/** Zuschlagssätze in Prozent auf den Funktions-Stundensatz */
export interface SubcompanySurchargeRates {
  nachtProzent?: number
  sonntagProzent?: number
  feiertagProzent?: number
}

// ===== EINLADUNGEN =====

export type InvitationType = 'INTERNAL_USER' | 'EMPLOYEE' | 'SUBCONTRACTOR'

// ===== RECHNUNGEN =====

export type ReceivedInvoiceStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'CHANGES_REQUESTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'SCHEDULED_FOR_PAYMENT'
  | 'PAID'
  | 'CANCELLED'

export type InvoiceLineType =
  | 'HOURS'
  | 'EMPLOYEES'
  | 'SHIFT'
  | 'SURCHARGE'
  | 'QUANTITY'
  | 'FLAT_RATE'
  | 'MATERIAL'
  | 'TRAVEL'
  | 'CUSTOM'

export type InvoiceUnit = 'h' | 'Stück' | 'Tag' | 'Schicht' | 'km' | 'pauschal'

export interface InvoiceLineItem {
  id: string
  type: InvoiceLineType
  description: string
  projectId?: string
  /** Eindeutiger Schlüssel des disponierten Einsatzes: `${projectId}::${rowKey}` */
  assignmentKey?: string
  serviceDate?: string
  quantity: number
  unit: InvoiceUnit
  unitPrice: number
  netAmount: number
  vatRate: number
  vatAmount: number
  grossAmount: number
  surchargeType?: string
  surchargePercentage?: number
}

export interface InvoiceStatusHistoryEntry {
  id: string
  previousStatus?: ReceivedInvoiceStatus
  newStatus: ReceivedInvoiceStatus
  message?: string
  changedByUserId: string
  changedByName?: string
  changedAt: string
}

export interface ReceivedInvoiceDto {
  id: string
  subcontractorCompanyId: string
  subcontractorCompanyName?: string
  createdByUserId: string
  invoiceNumber: string
  invoiceDate: string
  servicePeriodStart?: string
  servicePeriodEnd?: string
  projectIds: string[]
  orderNumber?: string
  purchaseOrderNumber?: string
  lineItems: InvoiceLineItem[]
  subtotalNet: number
  totalVat: number
  totalGross: number
  currency: 'EUR'
  paymentTermDays?: number
  dueDate?: string
  status: ReceivedInvoiceStatus
  submittedAt?: string
  reviewedAt?: string
  approvedAt?: string
  paidAt?: string
  reviewedByUserId?: string
  rejectionReason?: string
  changeRequestMessage?: string
  remarks?: string
  attachmentIds?: string[]
  generatedPdfDocumentId?: string
  statusHistory: InvoiceStatusHistoryEntry[]
  /** Serverseitig erkannte Abweichungen/Warnungen (z. B. Doppelabrechnung) */
  warnings?: string[]
  version: number
  createdAt?: string
  updatedAt?: string
}

// ===== EINSÄTZE (Portal-Sicht) =====

export type SubcontractorAssignmentStatus =
  | 'geplant'
  | 'durchgefuehrt'
  | 'bestaetigt'
  | 'teilweise_abgerechnet'
  | 'vollstaendig_abgerechnet'

export interface SubcontractorAssignment {
  /** `${projectId}::${rowKey}` – stabil für Rechnungszuordnung */
  assignmentKey: string
  projectId: string
  projectName: string
  projectNumber?: string
  day: string
  funktion: string
  count: number
  start: string
  ende: string
  pause: string
  stundenPerUnit: number
  stundenTotal: number
  fahrtstundenTotal: number
  nachtzulageTotal: number
  sonntagsstundenTotal: number
  feiertagTotal: number
  extraTotal: number
  status: SubcontractorAssignmentStatus
  /** Rechnungsnummer(n), in denen der Einsatz bereits verwendet wird */
  invoiceNumbers?: string[]
  bemerkung?: string
}

// ===== DOKUMENTE =====

export type SubcontractorDocumentType =
  | 'INVOICE_PDF'
  | 'INVOICE_ATTACHMENT'
  | 'TIMESHEET'
  | 'SERVICE_PROOF'
  | 'CERTIFICATE'
  | 'QUALIFICATION'
  | 'PROJECT_DOCUMENT'
  | 'OTHER'
  | 'INTERNAL_REVIEW'

export interface SubcontractorDocumentDto {
  id: string
  subcontractorCompanyId: string
  projectId?: string
  invoiceId?: string
  type: SubcontractorDocumentType
  name: string
  contentType?: string
  size?: number
  uploadedByUserId?: string
  uploadedByName?: string
  source: 'subcontractor' | 'internal'
  createdAt?: string
}

// ===== FEATURE FLAGS =====

export type SubcontractorFeatureFlag =
  | 'subcontractorPortalEnabled'
  | 'receivedInvoicesEnabled'
  | 'subcontractorInvitationsEnabled'
