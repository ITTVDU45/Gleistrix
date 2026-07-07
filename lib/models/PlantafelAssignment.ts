import mongoose from 'mongoose'

const plantafelAssignmentSchema = new mongoose.Schema({
  mitarbeiterId: { type: String, default: null },
  mitarbeiterName: { type: String, default: '' },
  projektId: { type: String, required: true },
  projektName: { type: String, default: '' },
  von: { type: Date, required: true },
  bis: { type: Date, required: true },
  rolle: { type: String, default: '' },
  notizen: { type: String, default: '' },
  bestaetigt: { type: Boolean, default: false },
  setupDate: { type: String, default: null },
  dismantleDate: { type: String, default: null },
  // Verknüpfung zum automatisch erzeugten Projekt-Zeiteintrag (Dual-Write)
  einsatzLinkId: { type: String, default: null },
  // Microsoft-365-Kalender-/Teams-Sync (Outlook-Termin im verbundenen Postfach)
  msCalendar: {
    type: {
      eventId: { type: String, default: null },
      iCalUId: { type: String, default: null },
      joinUrl: { type: String, default: null },
      lastSyncedAt: { type: Date, default: null },
      source: { type: String, enum: ['plantafel', 'outlook'], default: 'plantafel' },
    },
    default: null,
  },
}, {
  timestamps: true,
})

plantafelAssignmentSchema.index({ von: 1, bis: 1 })
plantafelAssignmentSchema.index({ mitarbeiterId: 1 })
plantafelAssignmentSchema.index({ projektId: 1 })

export default mongoose.models.PlantafelAssignment ||
  mongoose.model('PlantafelAssignment', plantafelAssignmentSchema)
