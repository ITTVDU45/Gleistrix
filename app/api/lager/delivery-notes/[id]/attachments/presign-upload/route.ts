import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { nanoid } from 'nanoid'
import dbConnect from '@/lib/dbConnect'
import { DeliveryNote } from '@/lib/models/DeliveryNote'
import { requireAuth } from '@/lib/security/requireAuth'
import minioClient, { getDeliveryNoteObjectKey } from '@/lib/storage/minioClient'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await dbConnect()
    const auth = await requireAuth(request, ['lager', 'user', 'admin', 'superadmin'])
    if (!auth.ok) return NextResponse.json({ success: false, message: auth.error }, { status: auth.status })

    const csrf = request.headers.get('x-csrf-intent')
    if (process.env.NODE_ENV === 'production' && csrf !== 'lager:delivery-note:attachment:presign') {
      return NextResponse.json({ success: false, message: 'Ungültige Anforderung' }, { status: 400 })
    }

    const bodySchema = z.object({
      filename: z.string().min(1),
      contentType: z.string().min(1),
      size: z.number().min(1)
    })
    const parseResult = bodySchema.safeParse(await request.json())
    if (!parseResult.success) {
      return NextResponse.json({ success: false, message: 'Validierungsfehler', issues: parseResult.error.flatten() }, { status: 400 })
    }
    const body = parseResult.data

    const { id } = await params
    const deliveryNote = await DeliveryNote.findById(id).lean()
    if (!deliveryNote) {
      return NextResponse.json({ success: false, message: 'Lieferschein nicht gefunden' }, { status: 404 })
    }

    const bucket = process.env.MINIO_BUCKET || 'project-documents'
    const attachmentId = nanoid(14)
    const objectKey = getDeliveryNoteObjectKey(id, `${attachmentId}-${body.filename}`)

    const expires = 60 * 10
    let uploadUrl = typeof (minioClient as any).presignedPutObjectAsync === 'function'
      ? await (minioClient as any).presignedPutObjectAsync(bucket, objectKey, expires)
      : await new Promise<string>((resolve, reject) => (minioClient as any).presignedPutObject(bucket, objectKey, expires, (err: unknown, url: string) => err ? reject(err) : resolve(url)))

    const publicUrl = process.env.MINIO_PUBLIC_URL
    if (publicUrl) {
      try {
        const uploadUrlObject = new URL(uploadUrl)
        const publicUrlObject = new URL(publicUrl)
        uploadUrlObject.protocol = publicUrlObject.protocol
        uploadUrlObject.host = publicUrlObject.host
        uploadUrl = uploadUrlObject.toString()
      } catch {}
    }

    return NextResponse.json({
      success: true,
      uploadUrl,
      attachmentId,
      objectKey,
      bucket
    })
  } catch (error) {
    console.error('Presign-Lieferscheinupload fehlgeschlagen:', error)
    return NextResponse.json({ success: false, message: 'Upload-Vorbereitung fehlgeschlagen' }, { status: 500 })
  }
}
