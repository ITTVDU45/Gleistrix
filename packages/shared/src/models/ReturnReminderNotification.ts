import mongoose, { Schema, models } from 'mongoose'

const ReturnReminderNotificationSchema = new Schema(
  {
    uniqueKey: { type: String, required: true, unique: true, index: true },
    assignmentId: {
      type: Schema.Types.ObjectId,
      ref: 'ArticleAssignment',
      required: true,
      index: true
    },
    recipientUserId: { type: String, required: true, index: true },
    recipientEmail: { type: String, required: true },
    recipientName: { type: String, default: '' },
    articleId: { type: Schema.Types.ObjectId, ref: 'Article' },
    articleName: { type: String, default: '' },
    articleNumber: { type: String, default: '' },
    employeeId: { type: Schema.Types.ObjectId, ref: 'Employee' },
    employeeName: { type: String, default: '' },
    dueDate: { type: Date, required: true, index: true },
    reminderDate: { type: String, required: true, index: true },
    interval: {
      value: { type: Number, required: true },
      unit: { type: String, enum: ['days', 'weeks', 'months'], required: true },
      label: { type: String, required: true }
    },
    message: { type: String, required: true },
    readAt: { type: Date, default: null },
    resolvedAt: { type: Date, default: null },
    emailStatus: {
      type: String,
      enum: ['pending', 'processing', 'sent', 'failed'],
      default: 'pending',
      index: true
    },
    emailAttempts: { type: Number, default: 0 },
    emailSentAt: { type: Date, default: null },
    lastEmailAttemptAt: { type: Date, default: null },
    nextEmailAttemptAt: { type: Date, default: null },
    emailError: { type: String, default: '' }
  },
  { timestamps: true }
)

ReturnReminderNotificationSchema.index({ recipientUserId: 1, resolvedAt: 1, readAt: 1, createdAt: -1 })

export default models.ReturnReminderNotification ||
  mongoose.model(
    'ReturnReminderNotification',
    ReturnReminderNotificationSchema,
    'return_reminder_notifications'
  )
