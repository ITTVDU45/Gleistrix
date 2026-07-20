import mongoose, { Schema, models, Document } from 'mongoose'
import type { SubcontractorDocumentType } from '@/types/subunternehmen'

export interface ISubcontractorDocument extends Document {
  subcontractorCompanyId: mongoose.Types.ObjectId
  projectId?: mongoose.Types.ObjectId
  invoiceId?: mongoose.Types.ObjectId
  type: SubcontractorDocumentType
  name: string
  bucket: string
  objectKey: string
  contentType?: string
  size?: number
  uploadedByUserId?: mongoose.Types.ObjectId
  uploadedByName?: string
  /** Wer hat das Dokument bereitgestellt (Portal vs. intern) */
  source: 'subcontractor' | 'internal'
  createdAt: Date
  updatedAt: Date
}

const SubcontractorDocumentSchema = new Schema<ISubcontractorDocument>(
  {
    subcontractorCompanyId: {
      type: Schema.Types.ObjectId,
      ref: 'Subcompany',
      required: true,
      index: true,
    },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', index: true },
    invoiceId: { type: Schema.Types.ObjectId, ref: 'ReceivedInvoice', index: true },
    type: {
      type: String,
      enum: [
        'INVOICE_PDF', 'INVOICE_ATTACHMENT', 'TIMESHEET', 'SERVICE_PROOF',
        'CERTIFICATE', 'QUALIFICATION', 'PROJECT_DOCUMENT', 'OTHER', 'INTERNAL_REVIEW',
      ],
      required: true,
    },
    name: { type: String, required: true },
    bucket: { type: String, required: true },
    objectKey: { type: String, required: true },
    contentType: { type: String },
    size: { type: Number },
    uploadedByUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    uploadedByName: { type: String },
    source: { type: String, enum: ['subcontractor', 'internal'], required: true },
  },
  { timestamps: true }
)

SubcontractorDocumentSchema.index({ subcontractorCompanyId: 1, type: 1, createdAt: -1 })

export default models.SubcontractorDocument ||
  mongoose.model<ISubcontractorDocument>('SubcontractorDocument', SubcontractorDocumentSchema, 'subcontractor_documents')
