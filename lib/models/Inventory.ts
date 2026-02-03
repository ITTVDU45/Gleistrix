import mongoose from 'mongoose'

const inventorySchema = new mongoose.Schema({
  typ: {
    type: String,
    enum: ['voll', 'teil'],
    required: true
  },
  stichtag: {
    type: Date,
    required: true
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
  lagerorte: {
    type: [String],
    default: []
  },
  positionen: [{
    artikelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Article' },
    sollMenge: { type: Number, default: 0 },
    istMenge: { type: Number, default: 0 },
    differenz: { type: Number, default: 0 }
  }],
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

export const Inventory = mongoose.models.Inventory || mongoose.model('Inventory', inventorySchema)
