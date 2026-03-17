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
  },
  typ: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
})

if (mongoose.models.Category) {
  delete (mongoose.models as Record<string, unknown>).Category
}
export const Category = mongoose.model('Category', categorySchema)
