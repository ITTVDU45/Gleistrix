import mongoose from 'mongoose'

const technikEntrySchema = new mongoose.Schema({
  id: String,
  name: String,
  anzahl: Number,
  meterlaenge: Number,
  bemerkung: String
}, { _id: false })

const timeEntrySchema = new mongoose.Schema({
  id: String,
  name: String,
  funktion: {
    type: String,
    enum: ['SIPO', 'HFE', 'Monteur/bediener', 'Sakra', 'BüP', 'HiBa', 'SAS', 'Bahnerder']
  },
  start: String,
  ende: String,
  stunden: Number,
  fahrtstunden: Number,
  pause: String,
  extra: Number,
  nachtzulage: String,
  sonntag: Number,
  feiertag: Number,
  bemerkung: String
}, { _id: false })

const vehicleAssignmentSchema = new mongoose.Schema({
  id: String,
  type: String,
  licensePlate: String,
  kilometers: String
}, { _id: false })

const projectSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  auftraggeber: {
    type: String,
    required: true
  },
  baustelle: {
    type: String,
    required: true
  },
  auftragsnummer: {
    type: String,
    required: true
  },
  sapNummer: {
    type: String,
    required: true
  },
  telefonnummer: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['aktiv', 'abgeschlossen', 'fertiggestellt', 'geleistet', 'teilweise_abgerechnet', 'kein Status'],
    default: 'aktiv'
  },
  atwsImEinsatz: {
    type: Boolean,
    default: false
  },
  anzahlAtws: {
    type: Number,
    default: 0
  },
  gesamtMeterlaenge: {
    type: Number,
    default: 0
  },
  datumBeginn: {
    type: String,
    required: true
  },
  datumEnde: {
    type: String,
    required: true
  },
  technik: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  mitarbeiterZeiten: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  fahrzeuge: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
  ,
  dokumente: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
  ,
  abgerechneteTage: {
    type: [String],
    default: []
  }
}, {
  timestamps: true,
  strict: false
})

// Prüfe, ob das Model bereits existiert, bevor es erstellt wird
export const Project = mongoose.models.Project || mongoose.model('Project', projectSchema) 