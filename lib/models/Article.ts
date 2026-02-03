import mongoose from 'mongoose'

const articleSchema = new mongoose.Schema({
  artikelnummer: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  bezeichnung: {
    type: String,
    required: true
  },
  kategorie: {
    type: String,
    required: true,
    index: true
  },
  unterkategorie: {
    type: String,
    default: '',
    index: true
  },
  typ: {
    type: String,
    enum: ['Werkzeug', 'Maschine', 'Akku', 'Komponente', 'Verbrauch', 'Sonstiges'],
    required: true
  },
  bestand: {
    type: Number,
    default: 0
  },
  mindestbestand: {
    type: Number,
    default: 0
  },
  lagerort: {
    type: String,
    default: '',
    index: true
  },
  seriennummer: {
    type: String,
    default: ''
  },
  zustand: {
    type: String,
    enum: ['neu', 'gut', 'gebraucht', 'defekt'],
    default: 'gut'
  },
  barcode: {
    type: String,
    unique: true,
    index: true
  },
  wartungsintervallMonate: {
    type: Number,
    default: null
  },
  naechsteWartung: {
    type: Date,
    default: null
  },
  wartungsstatus: {
    type: String,
    enum: ['ok', 'faellig', 'ueberfaellig', 'in_wartung'],
    default: 'ok'
  },
  status: {
    type: String,
    enum: ['aktiv', 'archiviert', 'gesperrt'],
    default: 'aktiv'
  }
}, {
  timestamps: true
})

export const Article = mongoose.models.Article || mongoose.model('Article', articleSchema)
