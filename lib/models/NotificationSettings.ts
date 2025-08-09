import mongoose, { Schema, models } from 'mongoose';

const NotificationSettingsSchema = new Schema(
  {
    scope: { type: String, default: 'global', unique: true },
    enabledByKey: { type: Map, of: Boolean, default: {} },
    configByKey: { type: Map, of: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

export default models.NotificationSettings ||
  mongoose.model('NotificationSettings', NotificationSettingsSchema, 'notification_settings');


