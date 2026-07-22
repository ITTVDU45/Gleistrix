import mongoose, { Document, Schema, models } from 'mongoose'

export interface IFinanceAccount extends Document {
  name: string
  type: 'bank' | 'cash'
  iban?: string
  bankName?: string
  openingBalanceCents: number
  balanceDate: Date
  isDefault: boolean
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

const FinanceAccountSchema = new Schema<IFinanceAccount>({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  type: { type: String, enum: ['bank', 'cash'], default: 'bank' },
  iban: { type: String, trim: true, uppercase: true },
  bankName: { type: String, trim: true },
  openingBalanceCents: { type: Number, required: true, default: 0 },
  balanceDate: { type: Date, required: true, default: Date.now },
  isDefault: { type: Boolean, default: false, index: true },
  isActive: { type: Boolean, default: true, index: true },
}, { timestamps: true })

FinanceAccountSchema.index({ name: 1 }, { unique: true })

export default models.FinanceAccount || mongoose.model<IFinanceAccount>('FinanceAccount', FinanceAccountSchema)
