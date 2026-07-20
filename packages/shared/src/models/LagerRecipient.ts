import mongoose, { Schema, models } from 'mongoose'

const lagerRecipientSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    normalizedName: { type: String, required: true, unique: true, index: true },
    active: { type: Boolean, default: true }
  },
  { timestamps: true }
)

export const LagerRecipient =
  models.LagerRecipient ||
  mongoose.model('LagerRecipient', lagerRecipientSchema, 'lager_recipients')