import { NextRequest, NextResponse } from 'next/server'
import dbConnect from '@/lib/dbConnect'
import { DeliveryNote } from '@/lib/models/DeliveryNote'
import { requireAuth } from '@/lib/security/requireAuth'
import minioClient from '@/lib/storage/minioClient'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string; attachmentId: string }> }) {
  try {
    await dbConnect()
    const auth = await requireAuth(request, ['lager', 'user', 'admin', 'superadmin'])
    if (!auth.ok) return NextResponse.json({ success: false, message: auth.error }, { status: auth.status })

    const { id, attachmentId } = await params
    const deliveryNote = await DeliveryNote.findById(id).lean()
    if (!deliveryNote) {
      return NextResponse.json({ success: false, message: 'Lieferschein nicht gefunden' }, { status: 404 })
    }

    const attachment = ((deliveryNote as any).attachments || []).find((entry: any) => entry.attachmentId === attachmentId)
    if (!attachment) {
      return NextResponse.json({ success: false, message: 'Anhang nicht gefunden' }, { status: 404 })
    }

    const expires = 60 * 5
    let url = typeof (minioClient as any).presignedGetObjectAsync === 'function'
      ? await (minioClient as any).presignedGetObjectAsync(attachment.bucket, attachment.objectKey, expires)
      : await new Promise<string>((resolve, reject) => (minioClient as any).presignedGetObject(attachment.bucket, attachment.objectKey, expires, (err: unknown, signedUrl: string) => err ? reject(err) : resolve(signedUrl)))

    const publicUrl = process.env.MINIO_PUBLIC_URL
    if (publicUrl) {
      try {
        const signedUrl = new URL(url)
        const publicUrlObject = new URL(publicUrl)
        signedUrl.protocol = publicUrlObject.protocol
        signedUrl.host = publicUrlObject.host
        url = signedUrl.toString()
      } catch {}
    }

    return NextResponse.json({ success: true, url })
  } catch (error) {
    console.error('Presign-Download Lieferscheinanhang fehlgeschlagen:', error)
    return NextResponse.json({ success: false, message: 'Download konnte nicht vorbereitet werden' }, { status: 500 })
  }
}
