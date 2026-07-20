import mongoose from 'mongoose'

/**
 * Geparste GAEB-LV-Struktur (Bill of Quantities). Lose/Titel/Positionen werden
 * als Mixed gehalten (flexibel, siehe types/gaeb.ts). Bei sehr großen LVs ist
 * das 16-MB-Dokumentlimit zu beachten – der Import-Service kann Langtexte
 * kürzen bzw. Positionen später in eine eigene Collection auslagern.
 */
const gaebBoqSchema = new mongoose.Schema(
  {
    importJobId: { type: String, required: true, index: true },
    version: { type: String, default: null },
    phase: { type: String, default: null },
    projectName: { type: String, default: '' },
    currency: { type: String, default: 'EUR' },
    netSum: { type: Number, default: null },
    grossSum: { type: Number, default: null },
    lots: { type: mongoose.Schema.Types.Mixed, default: [] },
    positionCount: { type: Number, default: 0 },
  },
  { timestamps: true }
)

export default mongoose.models.GaebBillOfQuantities ||
  mongoose.model('GaebBillOfQuantities', gaebBoqSchema)
