import mongoose from 'mongoose'

/**
 * Projektbezogene Ausschreibung/Angebot. Verknüpft ein Projekt mit einem
 * GAEB-Import (importJobId/boqId/fileId) oder – perspektivisch – manuell
 * erfassten Positionen.
 */
const ausschreibungSchema = new mongoose.Schema(
  {
    projectId: { type: String, required: true, index: true },
    kind: { type: String, enum: ['ausschreibung', 'angebot'], default: 'ausschreibung' },
    source: { type: String, enum: ['gaeb', 'manuell'], default: 'gaeb' },
    name: { type: String, default: '' },
    version: { type: String, default: null },
    phase: { type: String, default: null },
    importJobId: { type: String, default: null },
    boqId: { type: String, default: null },
    fileId: { type: String, default: null },
    positionCount: { type: Number, default: 0 },
    netSum: { type: Number, default: null },
    currency: { type: String, default: 'EUR' },
    createdByUserId: { type: String, default: null },
  },
  { timestamps: true }
)

ausschreibungSchema.index({ projectId: 1, createdAt: -1 })

export default mongoose.models.Ausschreibung ||
  mongoose.model('Ausschreibung', ausschreibungSchema)
