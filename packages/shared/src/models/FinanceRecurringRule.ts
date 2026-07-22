import mongoose, { Document, Schema, models } from 'mongoose'

export interface IFinanceRecurringRule extends Document {
  name: string
  interval: 'monthly' | 'quarterly' | 'yearly'
  nextDueDate: Date
  lastBookedPeriod?: string
  isActive: boolean
  entryTemplate: Record<string, unknown>
  createdBy?: mongoose.Types.ObjectId
  createdAt: Date
  updatedAt: Date
}

const FinanceRecurringRuleSchema = new Schema<IFinanceRecurringRule>({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  interval: { type: String, enum: ['monthly', 'quarterly', 'yearly'], required: true },
  nextDueDate: { type: Date, required: true, index: true },
  lastBookedPeriod: { type: String },
  isActive: { type: Boolean, default: true, index: true },
  entryTemplate: { type: Schema.Types.Mixed, required: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true })

export default models.FinanceRecurringRule || mongoose.model<IFinanceRecurringRule>('FinanceRecurringRule', FinanceRecurringRuleSchema)
