import mongoose, { Schema, models } from 'mongoose'

/**
 * Profil-Overrides für den ENV-Superadmin (der kein users-Dokument besitzt).
 * Speichert die im Profil editierbaren Felder (Name, Telefon). Die E-Mail
 * bleibt über SUPERADMIN_EMAIL fixiert und ist nicht änderbar.
 */
const SuperadminProfileSchema = new Schema(
  {
    scope: { type: String, default: 'env-superadmin', unique: true },
    name: { type: String },
    phone: { type: String },
  },
  { timestamps: true }
)

export default models.SuperadminProfile ||
  mongoose.model('SuperadminProfile', SuperadminProfileSchema, 'superadmin_profile')
