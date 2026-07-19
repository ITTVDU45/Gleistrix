import mongoose, { Schema, models } from 'mongoose'

/**
 * Globale Feature-Flags (Single-Tenant-Deployment → scope 'global').
 * Muster analog zu NotificationSettings.
 */
const FeatureFlagSettingsSchema = new Schema(
  {
    scope: { type: String, default: 'global', unique: true },
    flags: { type: Map, of: Boolean, default: {} },
  },
  { timestamps: true }
)

export default models.FeatureFlagSettings ||
  mongoose.model('FeatureFlagSettings', FeatureFlagSettingsSchema, 'feature_flag_settings')
