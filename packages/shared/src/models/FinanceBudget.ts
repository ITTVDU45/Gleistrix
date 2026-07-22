import mongoose, { Document, Schema, models } from 'mongoose'
import type { FinanceBudgetBasis } from '@/types/finance'

export interface IFinanceBudget extends Document {
  name: string
  categoryId?: mongoose.Types.ObjectId
  projectId?: mongoose.Types.ObjectId
  basis: FinanceBudgetBasis
  period: 'month' | 'quarter' | 'year'
  year: number
  month?: number
  quarter?: number
  limitCents: number
  warningPercent: number
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

const FinanceBudgetSchema = new Schema<IFinanceBudget>({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  categoryId: { type: Schema.Types.ObjectId, ref: 'FinanceCategory', index: true },
  projectId: { type: Schema.Types.ObjectId, ref: 'Project', index: true },
  basis: { type: String, enum: ['performance', 'cash'], default: 'performance' },
  period: { type: String, enum: ['month', 'quarter', 'year'], required: true },
  year: { type: Number, required: true, min: 2000, max: 2200 },
  month: { type: Number, min: 1, max: 12 },
  quarter: { type: Number, min: 1, max: 4 },
  limitCents: { type: Number, required: true, min: 0 },
  warningPercent: { type: Number, default: 80, min: 0, max: 100 },
  isActive: { type: Boolean, default: true, index: true },
}, { timestamps: true })

FinanceBudgetSchema.index({ year: 1, month: 1, quarter: 1, categoryId: 1, projectId: 1 })

export default models.FinanceBudget || mongoose.model<IFinanceBudget>('FinanceBudget', FinanceBudgetSchema)
