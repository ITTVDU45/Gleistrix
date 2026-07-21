import { NextRequest, NextResponse } from 'next/server'
import mongoose from 'mongoose'
import dbConnect from '@/lib/dbConnect'
import { logger } from '@/lib/logger'
import ReturnReminderNotification from '@/lib/models/ReturnReminderNotification'
import { getCurrentUser } from '@/lib/auth/getCurrentUser'
import { requireAuth } from '@/lib/security/requireAuth'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const csrf = request.headers.get('x-csrf-intent')
    if (process.env.NODE_ENV === 'production' && csrf !== 'lager:return-reminders:read') {
      return NextResponse.json({ success: false, message: 'Ungültige Anforderung' }, { status: 400 })
    }
    const auth = await requireAuth(request, ['lager', 'user', 'admin', 'superadmin'])
    if (!auth.ok) return NextResponse.json({ success: false, message: auth.error }, { status: auth.status })
    const currentUser = await getCurrentUser(request)
    if (!currentUser) return NextResponse.json({ success: false, message: 'Nicht angemeldet' }, { status: 401 })

    const { id } = await params
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, message: 'Ungültige Benachrichtigungs-ID' }, { status: 400 })
    }

    await dbConnect()
    const notification = await ReturnReminderNotification.findOneAndUpdate(
      { _id: id, recipientUserId: currentUser.id, resolvedAt: null },
      { $set: { readAt: new Date() } },
      { new: true }
    ).lean() as { readAt?: Date | null } | null
    if (!notification) {
      return NextResponse.json({ success: false, message: 'Benachrichtigung nicht gefunden' }, { status: 404 })
    }
    return NextResponse.json({ success: true, readAt: notification.readAt })
  } catch (error) {
    logger.error('Rückgabe-Benachrichtigung konnte nicht gelesen markiert werden', error)
    return NextResponse.json(
      { success: false, message: 'Benachrichtigung konnte nicht aktualisiert werden' },
      { status: 500 }
    )
  }
}
