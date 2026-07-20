import mongoose from 'mongoose'

/**
 * Import-Vorgang einer GAEB-Datei. Durchläuft die Stati
 * hochgeladen → validierung → validiert → geparst → zugeordnet (oder fehler).
 * Validierungsergebnis, Zuordnung und BoQ-Referenz werden hier gehalten.
 */
const gaebImportJobSchema = new mongoose.Schema(
  {
    fileId: { type: String, required: true, index: true },
    status: {
      type: String,
      enum: ['hochgeladen', 'validierung', 'validiert', 'geparst', 'zugeordnet', 'fehler'],
      default: 'hochgeladen',
    },
    version: { type: String, default: null },
    phase: { type: String, default: null },
    // Validierungsergebnis (GaebValidationResult) – Struktur flexibel
    validation: { type: mongoose.Schema.Types.Mixed, default: null },
    boqId: { type: String, default: null },
    // Zuordnung zu Projekt/Auftraggeber/Ausschreibung/Angebot
    assignment: { type: mongoose.Schema.Types.Mixed, default: null },
    createdByUserId: { type: String, default: null },
    error: { type: String, default: null },
  },
  { timestamps: true }
)

gaebImportJobSchema.index({ createdAt: -1 })

export default mongoose.models.GaebImportJob ||
  mongoose.model('GaebImportJob', gaebImportJobSchema)
