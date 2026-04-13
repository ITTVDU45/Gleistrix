import mongoose, { Schema, Document } from 'mongoose'

export type BillingPositionStatus = 'billed' | 'copied'

export interface IBillingPosition extends Document {
  projectId: mongoose.Types.ObjectId
  day: string
  rowKey: string
  sourceEntryId: string
  funktion: string
  count: number
  hoursPerUnit: number
  hoursTotal: number
  isExternal: boolean
  companyName?: string
  employeeName?: string
  status: BillingPositionStatus
  billedAt: Date
  billedBy?: {
    userId?: mongoose.Types.ObjectId
    name?: string
    role?: string
  }
}

const BillingPositionSchema = new Schema<IBillingPosition>({
  projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  day: { type: String, required: true, index: true },
  rowKey: { type: String, required: true, index: true },
  sourceEntryId: { type: String, required: true },
  funktion: { type: String, required: true },
  count: { type: Number, required: true, default: 1 },
  hoursPerUnit: { type: Number, required: true, default: 0 },
  hoursTotal: { type: Number, required: true, default: 0 },
  isExternal: { type: Boolean, required: true, default: false },
  companyName: { type: String },
  employeeName: { type: String },
  status: { type: String, enum: ['billed', 'copied'], default: 'billed', index: true },
  billedAt: { type: Date, default: Date.now, index: true },
  billedBy: {
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    name: { type: String },
    role: { type: String }
  }
}, { timestamps: true })

BillingPositionSchema.index({ projectId: 1, rowKey: 1 })
BillingPositionSchema.index({ projectId: 1, day: 1, status: 1 })

export default (mongoose.models.BillingPosition as any) || mongoose.model<IBillingPosition>('BillingPosition', BillingPositionSchema)
