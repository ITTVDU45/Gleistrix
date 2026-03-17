import mongoose from 'mongoose'

const inventorySchema = new mongoose.Schema({
  name: {
    type: String,
    trim: true,
    default: ''
  },
  beschreibung: {
    type: String,
    trim: true,
    default: ''
  },
  typ: {
    type: String,
    enum: ['voll', 'teil'],
    required: true
  },
  stichtag: {
    type: Date,
    required: true
  },
  zeitraumVon: {
    type: Date,
    default: null
  },
  zeitraumBis: {
    type: Date,
    default: null
  },
  status: {
    type: String,
    enum: ['offen', 'in_bearbeitung', 'abgeschlossen'],
    default: 'offen'
  },
  kategorien: {
    type: [String],
    default: []
  },
  artikelIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Article'
  }],
  lagerorte: {
    type: [String],
    default: []
  },
  positionen: [{
    artikelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Article' },
    sollMenge: { type: Number, default: 0 },
    istMenge: { type: Number, default: 0 },
    differenz: { type: Number, default: 0 },
    unitIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'ArticleUnit' }]
  }],
  scanEvents: [{
    artikelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Article' },
    unitId: { type: mongoose.Schema.Types.ObjectId, ref: 'ArticleUnit', default: null },
    code: { type: String, trim: true },
    scannedAt: { type: Date, required: true },
    scannedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    sessionId: { type: String, default: '' }
  }],
  scanSessions: [{
    sessionId: { type: String, required: true },
    startedAt: { type: Date, required: true },
    endedAt: { type: Date, default: null },
    startedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    endedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    scans: { type: Number, default: 0 }
  }],
  activeScanSessionId: {
    type: String,
    default: null
  },
  lastScanAt: {
    type: Date,
    default: null
  },
  abgeschlossenAm: {
    type: Date,
    default: null
  },
  abgeschlossenVon: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
})

if (process.env.NODE_ENV !== 'production' && mongoose.models.Inventory) {
  delete mongoose.models.Inventory
}

export const Inventory = mongoose.models.Inventory || mongoose.model('Inventory', inventorySchema)
