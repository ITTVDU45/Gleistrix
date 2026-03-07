import mongoose from 'mongoose'

const deliveryNoteSchema = new mongoose.Schema({
  typ: {
    type: String,
    enum: ['eingang', 'ausgang'],
    required: true
  },
  nummer: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  datum: {
    type: Date,
    required: true
  },
  empfaenger: {
    name: { type: String, default: '' },
    adresse: { type: String, default: '' }
  },
  positionen: [{
    artikelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Article' },
    bezeichnung: { type: String },
    menge: { type: Number },
    seriennummer: { type: String, default: '' }
  }],
  verantwortlich: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  status: {
    type: String,
    enum: ['entwurf', 'abgeschlossen'],
    default: 'abgeschlossen'
  },
  pdfUrl: {
    type: String,
    default: ''
  },
  attachments: [{
    attachmentId: { type: String, required: true },
    filename: { type: String, required: true },
    contentType: { type: String, default: 'application/octet-stream' },
    size: { type: Number, default: 0 },
    bucket: { type: String, required: true },
    objectKey: { type: String, required: true },
    supplier: { type: String, default: '' },
    reference: { type: String, default: '' },
    noteDate: { type: Date, required: false },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now }
  }]
}, {
  timestamps: true
})

export const DeliveryNote = mongoose.models.DeliveryNote || mongoose.model('DeliveryNote', deliveryNoteSchema)
