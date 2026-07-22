import mongoose, { Document, Schema, models } from 'mongoose'
import type { FinanceDirection } from '@/types/finance'

export interface IFinanceCategory extends Document {
  slug: string
  name: string
  direction: FinanceDirection | 'both'
  color: string
  isSystem: boolean
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

const FinanceCategorySchema = new Schema<IFinanceCategory>({
  slug: { type: String, required: true, trim: true, lowercase: true },
  name: { type: String, required: true, trim: true, maxlength: 100 },
  direction: { type: String, enum: ['income', 'expense', 'both'], default: 'expense' },
  color: { type: String, default: '#64748b' },
  isSystem: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true, index: true },
}, { timestamps: true })

FinanceCategorySchema.index({ slug: 1 }, { unique: true })

export default models.FinanceCategory || mongoose.model<IFinanceCategory>('FinanceCategory', FinanceCategorySchema)
