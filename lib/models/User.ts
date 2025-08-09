import mongoose, { Schema, models } from 'mongoose';

const UserSchema = new Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  name: { type: String },
  firstName: { type: String },
  lastName: { type: String },
  phone: { type: String },
  address: { type: String },
  role: { 
    type: String, 
    enum: ['superadmin', 'admin', 'user'], 
    default: 'user',
    required: true 
  },
  resetToken: { type: String },
  resetTokenExpiry: { type: Date },
  isActive: { type: Boolean, default: true },
  lastLogin: { type: Date },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  welcomeEmailSent: { type: Boolean, default: false },
  welcomeEmailSentAt: { type: Date }
}, { timestamps: true });

export default models.User || mongoose.model('User', UserSchema, 'users'); 