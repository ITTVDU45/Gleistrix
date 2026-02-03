import mongoose from 'mongoose'

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  parentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    default: null
  },
  beschreibung: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
})

export const Category = mongoose.models.Category || mongoose.model('Category', categorySchema)
