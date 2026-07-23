import mongoose, { Document, Schema, models } from 'mongoose'
import type { FinanceDirection, FinanceLedgerEffect, FinancePaymentStatus, FinanceSource } from '@/types/finance'

export interface IFinanceEntry extends Document {
  direction: FinanceDirection
  title: string
  description?: string
  categoryId?: mongoose.Types.ObjectId
  recognitionDate: Date
  dueDate?: Date
  paidAt?: Date
  paymentStatus: FinancePaymentStatus
  ledgerEffect: FinanceLedgerEffect
  source: FinanceSource
  sourceKey?: string
  netCents: number
  vatCents: number
  grossCents: number
  vatRate: number
  accountId?: mongoose.Types.ObjectId
  projectId?: mongoose.Types.ObjectId
  employeeId?: mongoose.Types.ObjectId
  subcompanyId?: mongoose.Types.ObjectId
  receivedInvoiceId?: mongoose.Types.ObjectId
  vehicleId?: mongoose.Types.ObjectId
  materialId?: mongoose.Types.ObjectId
  reference?: string
  invoiceNumber?: string
  importFingerprint?: string
  attachment?: { objectName: string; fileName: string; contentType: string; size: number }
  createdBy?: mongoose.Types.ObjectId
  createdAt: Date
  updatedAt: Date
}

const FinanceEntrySchema = new Schema<IFinanceEntry>({
  direction: { type: String, enum: ['income', 'expense'], required: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 200 },
  description: { type: String, trim: true, maxlength: 2000 },
  categoryId: { type: Schema.Types.ObjectId, ref: 'FinanceCategory', index: true },
  recognitionDate: { type: Date, required: true, index: true },
  dueDate: { type: Date },
  paidAt: { type: Date, index: true },
  paymentStatus: { type: String, enum: ['open', 'paid', 'cancelled', 'not_applicable'], default: 'open', index: true },
  ledgerEffect: { type: String, enum: ['performance', 'cash', 'both'], default: 'both', index: true },
  source: {
    type: String,
    enum: ['manual', 'ai_receipt', 'recurring', 'bank_csv', 'employee_time', 'project_revenue', 'subcontractor_estimate', 'subcontractor_invoice', 'adjustment'],
    default: 'manual',
    index: true,
  },
  sourceKey: { type: String, trim: true },
  netCents: { type: Number, required: true, min: 0 },
  vatCents: { type: Number, required: true, min: 0, default: 0 },
  grossCents: { type: Number, required: true, min: 0 },
  vatRate: { type: Number, required: true, min: 0, max: 100, default: 0 },
  accountId: { type: Schema.Types.ObjectId, ref: 'FinanceAccount', index: true },
  projectId: { type: Schema.Types.ObjectId, ref: 'Project', index: true },
  employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', index: true },
  subcompanyId: { type: Schema.Types.ObjectId, ref: 'Subcompany', index: true },
  receivedInvoiceId: { type: Schema.Types.ObjectId, ref: 'ReceivedInvoice', index: true },
  vehicleId: { type: Schema.Types.ObjectId, ref: 'Vehicle' },
  materialId: { type: Schema.Types.ObjectId, ref: 'Article' },
  reference: { type: String, trim: true, maxlength: 300 },
  invoiceNumber: { type: String, trim: true, maxlength: 100 },
  importFingerprint: { type: String, trim: true },
  attachment: {
    objectName: { type: String },
    fileName: { type: String },
    contentType: { type: String },
    size: { type: Number },
  },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true })

FinanceEntrySchema.index({ sourceKey: 1 }, { unique: true, sparse: true })
FinanceEntrySchema.index({ importFingerprint: 1 }, { unique: true, sparse: true })
FinanceEntrySchema.index({ recognitionDate: -1, direction: 1 })

export default models.FinanceEntry || mongoose.model<IFinanceEntry>('FinanceEntry', FinanceEntrySchema)
