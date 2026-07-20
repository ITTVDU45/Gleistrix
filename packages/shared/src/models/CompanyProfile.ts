import mongoose, { Schema, models } from 'mongoose'

/**
 * Firmenprofil des absendenden (internen) Unternehmens – ein globaler
 * Singleton (scope 'global'). Steuert Firmenname und Logo für E-Mails und
 * Dokumente. Das Logo liegt als Base64 in der DB (klein, kein Filesystem-/
 * MinIO-Bedarf; funktioniert damit auch in Serverless-Umgebungen).
 */
const CompanyProfileSchema = new Schema(
  {
    scope: { type: String, default: 'global', unique: true },
    companyName: { type: String, default: '' },
    /** Data-URI-fähiger Base64-String OHNE Präfix */
    logoBase64: { type: String },
    logoContentType: { type: String },
  },
  { timestamps: true }
)

export default models.CompanyProfile ||
  mongoose.model('CompanyProfile', CompanyProfileSchema, 'company_profile')
