import mongoose, { Schema, models, Document } from 'mongoose'
import type {
  InvoiceLineItem,
  InvoiceStatusHistoryEntry,
  ReceivedInvoiceStatus,
} from '@/types/subunternehmen'

export interface IReceivedInvoice extends Document {
  subcontractorCompanyId: mongoose.Types.ObjectId
  createdByUserId: mongoose.Types.ObjectId
  invoiceNumber: string
  invoiceDate: Date
  servicePeriodStart?: Date
  servicePeriodEnd?: Date
  projectIds: mongoose.Types.ObjectId[]
  orderNumber?: string
  purchaseOrderNumber?: string
  lineItems: InvoiceLineItem[]
  subtotalNet: number
  totalVat: number
  totalGross: number
  currency: 'EUR'
  paymentTermDays?: number
  dueDate?: Date
  status: ReceivedInvoiceStatus
  submittedAt?: Date
  reviewedAt?: Date
  approvedAt?: Date
  paidAt?: Date
  reviewedByUserId?: mongoose.Types.ObjectId
  rejectionReason?: string
  changeRequestMessage?: string
  remarks?: string
  attachmentIds: mongoose.Types.ObjectId[]
  generatedPdfDocumentId?: mongoose.Types.ObjectId
  /** Interne Prüfnotizen – dürfen NIE ins Subunternehmen-Portal gelangen */
  internalNotes: Array<{
    id: string
    text: string
    createdByUserId?: mongoose.Types.ObjectId
    createdByName?: string
    createdAt: Date
  }>
  statusHistory: InvoiceStatusHistoryEntry[]
  warnings: string[]
  version: number
  previousVersionId?: mongoose.Types.ObjectId
  createdAt: Date
  updatedAt: Date
}

const LineItemSchema = new Schema(
  {
    id: { type: String, required: true },
    type: {
      type: String,
      enum: ['HOURS', 'EMPLOYEES', 'SHIFT', 'SURCHARGE', 'QUANTITY', 'FLAT_RATE', 'MATERIAL', 'TRAVEL', 'CUSTOM'],
      required: true,
    },
    description: { type: String, required: true },
    projectId: { type: String },
    assignmentKey: { type: String },
    serviceDate: { type: String },
    quantity: { type: Number, required: true },
    unit: {
      type: String,
      enum: ['h', 'Stück', 'Tag', 'Schicht', 'km', 'pauschal'],
      required: true,
    },
    unitPrice: { type: Number, required: true },
    netAmount: { type: Number, required: true },
    vatRate: { type: Number, required: true },
    vatAmount: { type: Number, required: true },
    grossAmount: { type: Number, required: true },
    surchargeType: { type: String },
    surchargePercentage: { type: Number },
  },
  { _id: false }
)

const StatusHistorySchema = new Schema(
  {
    id: { type: String, required: true },
    previousStatus: { type: String },
    newStatus: { type: String, required: true },
    message: { type: String },
    changedByUserId: { type: String, required: true },
    changedByName: { type: String },
    changedAt: { type: Date, required: true },
  },
  { _id: false }
)

const InternalNoteSchema = new Schema(
  {
    id: { type: String, required: true },
    text: { type: String, required: true },
    createdByUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    createdByName: { type: String },
    createdAt: { type: Date, required: true },
  },
  { _id: false }
)

const ReceivedInvoiceSchema = new Schema<IReceivedInvoice>(
  {
    subcontractorCompanyId: {
      type: Schema.Types.ObjectId,
      ref: 'Subcompany',
      required: true,
      index: true,
    },
    createdByUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    invoiceNumber: { type: String, required: true },
    invoiceDate: { type: Date, required: true },
    servicePeriodStart: { type: Date },
    servicePeriodEnd: { type: Date },
    projectIds: [{ type: Schema.Types.ObjectId, ref: 'Project' }],
    orderNumber: { type: String },
    purchaseOrderNumber: { type: String },
    lineItems: { type: [LineItemSchema], default: [] },
    subtotalNet: { type: Number, required: true, default: 0 },
    totalVat: { type: Number, required: true, default: 0 },
    totalGross: { type: Number, required: true, default: 0 },
    currency: { type: String, enum: ['EUR'], default: 'EUR' },
    paymentTermDays: { type: Number },
    dueDate: { type: Date },
    status: {
      type: String,
      enum: [
        'DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'CHANGES_REQUESTED',
        'APPROVED', 'REJECTED', 'SCHEDULED_FOR_PAYMENT', 'PAID', 'CANCELLED',
      ],
      default: 'DRAFT',
      index: true,
    },
    submittedAt: { type: Date },
    reviewedAt: { type: Date },
    approvedAt: { type: Date },
    paidAt: { type: Date },
    reviewedByUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    rejectionReason: { type: String },
    changeRequestMessage: { type: String },
    remarks: { type: String },
    attachmentIds: [{ type: Schema.Types.ObjectId, ref: 'SubcontractorDocument' }],
    generatedPdfDocumentId: { type: Schema.Types.ObjectId, ref: 'SubcontractorDocument' },
    internalNotes: { type: [InternalNoteSchema], default: [] },
    statusHistory: { type: [StatusHistorySchema], default: [] },
    warnings: { type: [String], default: [] },
    version: { type: Number, default: 1 },
    previousVersionId: { type: Schema.Types.ObjectId, ref: 'ReceivedInvoice' },
  },
  { timestamps: true }
)

// Rechnungsnummer pro Subunternehmen eindeutig (stornierte Revisionen ausgenommen
// wird applikativ geprüft; der Index sichert die harte Grundregel ab)
ReceivedInvoiceSchema.index(
  { subcontractorCompanyId: 1, invoiceNumber: 1, version: 1 },
  { unique: true }
)
ReceivedInvoiceSchema.index({ status: 1, submittedAt: -1 })
ReceivedInvoiceSchema.index({ 'lineItems.assignmentKey': 1 })

export default models.ReceivedInvoice ||
  mongoose.model<IReceivedInvoice>('ReceivedInvoice', ReceivedInvoiceSchema, 'received_invoices')
