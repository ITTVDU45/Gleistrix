import { NextRequest, NextResponse } from 'next/server'
import dbConnect from '@/lib/dbConnect'
import { DeliveryNote } from '@/lib/models/DeliveryNote'
import { requireAuth } from '@/lib/security/requireAuth'
import { removeObject } from '@/lib/storage/minioClient'

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string; attachmentId: string }> }) {
  try {
    await dbConnect()
    const auth = await requireAuth(request, ['lager', 'admin', 'superadmin'])
    if (!auth.ok) return NextResponse.json({ success: false, message: auth.error }, { status: auth.status })

    const csrf = request.headers.get('x-csrf-intent')
    if (process.env.NODE_ENV === 'production' && csrf !== 'lager:delivery-note:attachment:delete') {
      return NextResponse.json({ success: false, message: 'Ungültige Anforderung' }, { status: 400 })
    }

    const { id, attachmentId } = await params
    const deliveryNote = await DeliveryNote.findById(id)
    if (!deliveryNote) {
      return NextResponse.json({ success: false, message: 'Lieferschein nicht gefunden' }, { status: 404 })
    }

    const attachments = ((deliveryNote as any).attachments || []) as Array<{ attachmentId: string; bucket: string; objectKey: string }>
    const foundAttachment = attachments.find((entry) => entry.attachmentId === attachmentId)
    if (!foundAttachment) {
      return NextResponse.json({ success: false, message: 'Anhang nicht gefunden' }, { status: 404 })
    }

    try {
      await removeObject(foundAttachment.bucket, foundAttachment.objectKey)
    } catch (storageError) {
      console.warn('MinIO removeObject fehlgeschlagen:', storageError)
    }

    await DeliveryNote.findByIdAndUpdate(id, { $pull: { attachments: { attachmentId } } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Löschen Lieferscheinanhang fehlgeschlagen:', error)
    return NextResponse.json({ success: false, message: 'Anhang konnte nicht gelöscht werden' }, { status: 500 })
  }
}
