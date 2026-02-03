import mongoose from 'mongoose'

const articleAssignmentSchema = new mongoose.Schema({
  artikelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Article',
    required: true,
    index: true
  },
  personId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true,
    index: true
  },
  menge: {
    type: Number,
    default: 1
  },
  ausgabedatum: {
    type: Date,
    required: true,
    index: true
  },
  rueckgabedatum: {
    type: Date,
    default: null
  },
  geplanteRueckgabe: {
    type: Date,
    default: null
  },
  status: {
    type: String,
    enum: ['ausgegeben', 'zurueckgegeben', 'ueberfaellig'],
    default: 'ausgegeben'
  },
  bemerkung: {
    type: String,
    default: ''
  },
  lieferscheinId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DeliveryNote',
    default: null
  }
}, {
  timestamps: true
})

export const ArticleAssignment = mongoose.models.ArticleAssignment || mongoose.model('ArticleAssignment', articleAssignmentSchema)
