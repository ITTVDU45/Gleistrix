import mongoose from 'mongoose'

/**
 * Holiday Model - Zentrale Feiertags-Konfiguration
 * Ermöglicht die Verwaltung von Feiertagen nach Bundesland
 */

const holidaySchema = new mongoose.Schema({
  date: {
    type: String, // Format: YYYY-MM-DD
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true
  },
  bundesland: {
    type: String,
    default: 'ALL', // ALL = bundesweit, sonst Länderkürzel wie BY, NRW, etc.
    index: true
  }
}, {
  timestamps: true
})

// Compound Index für schnelle Abfragen nach Datum und Bundesland
holidaySchema.index({ date: 1, bundesland: 1 }, { unique: true })

// Prüfe, ob das Model bereits existiert, bevor es erstellt wird
export const Holiday = mongoose.models.Holiday || mongoose.model('Holiday', holidaySchema)

// TypeScript Interface
export interface IHoliday {
  _id: string
  date: string
  name: string
  bundesland: string
  createdAt: Date
  updatedAt: Date
}
