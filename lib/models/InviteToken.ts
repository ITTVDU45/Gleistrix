import mongoose, { Schema, models } from 'mongoose';

const InviteTokenSchema = new Schema({
  email: { type: String, required: true },
  role: {
    type: String,
    enum: ['superadmin', 'admin', 'user'],
    required: true
  },
  token: { type: String, required: true, unique: true },
  used: { type: Boolean, default: false },
  expiresAt: { type: Date, required: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String },
  firstName: { type: String },
  lastName: { type: String },
  phone: { type: String }
}, { timestamps: true });

// Entferne doppelten Index, da das Feld bereits unique ist
// InviteTokenSchema.index({ token: 1 });
InviteTokenSchema.index({ email: 1 });
InviteTokenSchema.index({ expiresAt: 1 });

export default models.InviteToken || mongoose.model('InviteToken', InviteTokenSchema, 'inviteTokens'); 