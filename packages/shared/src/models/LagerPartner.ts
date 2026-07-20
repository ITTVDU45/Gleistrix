import mongoose, { Schema, models } from 'mongoose'

const lagerPartnerSchema = new Schema(
  {
    type: { type: String, enum: ['employee', 'external'], required: true, index: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: false, index: true },
    companyName: { type: String, default: '' },
    contactName: { type: String, default: '' },
    phone: { type: String, default: '' },
    email: { type: String, default: '' },
    active: { type: Boolean, default: true, index: true },
    normalizedKey: { type: String, required: true, unique: true, index: true }
  },
  { timestamps: true }
)

export const LagerPartner =
  models.LagerPartner || mongoose.model('LagerPartner', lagerPartnerSchema, 'lager_partners')
