import mongoose from 'mongoose'

const articleTypeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  }
}, {
  timestamps: true
})

export const ArticleType = mongoose.models.ArticleType || mongoose.model('ArticleType', articleTypeSchema)
