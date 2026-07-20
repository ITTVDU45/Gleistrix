import mongoose from 'mongoose'

/**
 * Eigenständiges (projektunabhängiges) Meeting auf der Plantafel.
 * Wird als Teams-Online-Meeting im verbundenen Microsoft-365-Postfach angelegt;
 * Teilnehmer sind Mitarbeiter (mit employeeId) und/oder externe E-Mail-Adressen.
 */
const attendeeSchema = new mongoose.Schema(
  {
    employeeId: { type: String, default: null },
    name: { type: String, default: '' },
    email: { type: String, required: true },
  },
  { _id: false }
)

const plantafelMeetingSchema = new mongoose.Schema(
  {
    titel: { type: String, required: true },
    von: { type: Date, required: true },
    bis: { type: Date, required: true },
    // 'teams' = Online-Besprechung mit Join-Link, 'vorOrt' = Präsenz mit Adresse
    modus: { type: String, enum: ['teams', 'vorOrt'], default: 'teams' },
    ort: { type: String, default: '' },
    notizen: { type: String, default: '' },
    attendees: { type: [attendeeSchema], default: [] },
    createdByUserId: { type: String, default: null },
    // Microsoft-365-Kalender-/Teams-Sync
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
  },
  { timestamps: true }
)

plantafelMeetingSchema.index({ von: 1, bis: 1 })

export default mongoose.models.PlantafelMeeting ||
  mongoose.model('PlantafelMeeting', plantafelMeetingSchema)
