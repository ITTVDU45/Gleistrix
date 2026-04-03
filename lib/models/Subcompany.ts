import mongoose from 'mongoose'

const subcompanySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    employeeCount: { type: Number, required: true, min: 1 },
    address: { type: String, default: '' },
    phone: { type: String, default: '' },
    email: { type: String, default: '' },
    bankAccount: { type: String, default: '' },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
)

export const Subcompany =
  mongoose.models.Subcompany || mongoose.model('Subcompany', subcompanySchema)
