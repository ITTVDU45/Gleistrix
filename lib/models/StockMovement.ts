import mongoose from 'mongoose'

const stockMovementSchema = new mongoose.Schema({
  artikelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Article',
    required: true,
    index: true
  },
  bewegungstyp: {
    type: String,
    enum: ['eingang', 'ausgang', 'korrektur', 'inventur'],
    required: true
  },
  menge: {
    type: Number,
    required: true
  },
  datum: {
    type: Date,
    required: true,
    index: true
  },
  verantwortlich: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  empfaenger: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee'
  },
  lieferscheinId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DeliveryNote'
  },
  bemerkung: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
})

export const StockMovement = mongoose.models.StockMovement || mongoose.model('StockMovement', stockMovementSchema)
