import mongoose, { Schema, models } from 'mongoose';

const NotificationLogSchema = new Schema(
  {
    timestamp: { type: Date, default: Date.now },
    key: { type: String, required: true },
    to: { type: String, required: true },
    subject: { type: String, required: true },
    success: { type: Boolean, default: false },
    errorMessage: { type: String },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project' },
    projectName: { type: String },
    attachmentsCount: { type: Number, default: 0 },
    meta: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

export default models.NotificationLog ||
  mongoose.model('NotificationLog', NotificationLogSchema, 'notification_logs');


