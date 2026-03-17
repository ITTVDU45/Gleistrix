import mongoose from 'mongoose'

const articleUnitSchema = new mongoose.Schema({
  artikelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Article',
    required: true,
    index: true
  },
  seriennummer: {
    type: String,
    required: true
  },
  barcode: {
    type: String,
    unique: true,
    index: true
  },
  status: {
    type: String,
    enum: ['verfuegbar', 'ausgegeben', 'in_wartung', 'defekt', 'archiviert'],
    default: 'verfuegbar'
  },
  zustand: {
    type: String,
    enum: ['neu', 'gut', 'gebraucht', 'defekt'],
    default: 'neu'
  },
  lagerort: {
    type: String,
    default: ''
  },
  notizen: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
})

articleUnitSchema.index({ artikelId: 1, seriennummer: 1 }, { unique: true })

export const ArticleUnit = mongoose.models.ArticleUnit || mongoose.model('ArticleUnit', articleUnitSchema)
