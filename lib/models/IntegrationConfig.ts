import mongoose from 'mongoose'

const integrationConfigSchema = new mongoose.Schema({
  integrationId: { type: String, required: true, unique: true },
  status: { type: String, enum: ['disconnected', 'connected', 'error'], default: 'disconnected' },
  config: { type: mongoose.Schema.Types.Mixed, default: {} },
  lastCheckedAt: { type: Date, default: null },
  lastError: { type: String, default: null },
  connectedByUserId: { type: String, default: null },
}, {
  timestamps: true,
})

export default mongoose.models.IntegrationConfig ||
  mongoose.model('IntegrationConfig', integrationConfigSchema)
