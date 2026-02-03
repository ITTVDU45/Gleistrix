import mongoose from 'mongoose'

const maintenanceSchema = new mongoose.Schema({
  artikelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Article',
    required: true,
    index: true
  },
  wartungsart: {
    type: String,
    required: true
  },
  faelligkeitsdatum: {
    type: Date,
    required: true,
    index: true
  },
  durchfuehrungsdatum: {
    type: Date,
    default: null
  },
  status: {
    type: String,
    enum: ['geplant', 'faellig', 'durchgefuehrt', 'nicht_bestanden'],
    default: 'geplant'
  },
  ergebnis: {
    type: String,
    default: ''
  },
  naechsterTermin: {
    type: Date,
    default: null
  },
  durchgefuehrtVon: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
})

export const Maintenance = mongoose.models.Maintenance || mongoose.model('Maintenance', maintenanceSchema)
