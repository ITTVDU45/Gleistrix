import { NextRequest, NextResponse } from 'next/server'
import dbConnect from '@/lib/dbConnect'
import { logger } from '@/lib/logger'
import ReturnReminderNotification from '@/lib/models/ReturnReminderNotification'
import { getCurrentUser } from '@/lib/auth/getCurrentUser'
import { requireAuth } from '@/lib/security/requireAuth'

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request, ['lager', 'user', 'admin', 'superadmin'])
    if (!auth.ok) return NextResponse.json({ success: false, message: auth.error }, { status: auth.status })
    const currentUser = await getCurrentUser(request)
    if (!currentUser) return NextResponse.json({ success: false, message: 'Nicht angemeldet' }, { status: 401 })

    await dbConnect()
    const notifications = await ReturnReminderNotification.find({
      recipientUserId: currentUser.id,
      resolvedAt: null,
    })
      .sort({ readAt: 1, dueDate: 1, createdAt: -1 })
      .limit(50)
      .lean()

    return NextResponse.json({
      success: true,
      unreadCount: notifications.filter((notification) => !notification.readAt).length,
      notifications: notifications.map((notification) => ({
        id: String(notification._id),
        assignmentId: String(notification.assignmentId),
        articleName: notification.articleName,
        articleNumber: notification.articleNumber,
        employeeName: notification.employeeName,
        dueDate: notification.dueDate,
        reminderDate: notification.reminderDate,
        intervalLabel: notification.interval?.label,
        message: notification.message,
        readAt: notification.readAt,
        emailStatus: notification.emailStatus,
        createdAt: notification.createdAt,
      })),
    })
  } catch (error) {
    logger.error('Rückgabe-Benachrichtigungen konnten nicht geladen werden', error)
    return NextResponse.json(
      { success: false, message: 'Rückgabe-Benachrichtigungen konnten nicht geladen werden' },
      { status: 500 }
    )
  }
}
