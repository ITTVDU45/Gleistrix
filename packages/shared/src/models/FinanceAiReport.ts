import mongoose, { Document, Schema, models } from 'mongoose'

export interface IFinanceAiReport extends Omit<Document, 'model'> {
  title: string
  content: string
  model: string
  periodFrom: Date
  periodTo: Date
  dataSnapshot: Record<string, unknown>
  createdBy?: mongoose.Types.ObjectId
  createdAt: Date
  updatedAt: Date
}

const FinanceAiReportSchema = new Schema<IFinanceAiReport>({
  title: { type: String, required: true, trim: true, maxlength: 180 },
  content: { type: String, required: true },
  model: { type: String, required: true },
  periodFrom: { type: Date, required: true },
  periodTo: { type: Date, required: true },
  dataSnapshot: { type: Schema.Types.Mixed, required: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true })

FinanceAiReportSchema.index({ createdAt: -1 })

export default models.FinanceAiReport || mongoose.model<IFinanceAiReport>('FinanceAiReport', FinanceAiReportSchema)
