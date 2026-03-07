import { NextRequest, NextResponse } from 'next/server'
import dbConnect from '@/lib/dbConnect'
import { Article } from '@/lib/models/Article'
import { requireAuth } from '@/lib/security/requireAuth'
import minioClient from '@/lib/storage/minioClient'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  try {
    await dbConnect()
    const auth = await requireAuth(request, ['lager', 'user', 'admin', 'superadmin'])
    if (!auth.ok) return NextResponse.json({ success: false, message: auth.error }, { status: auth.status })

    const { id, attachmentId } = await params
    const article = await Article.findById(id).lean()
    if (!article) {
      return NextResponse.json({ success: false, message: 'Artikel nicht gefunden' }, { status: 404 })
    }

    const images = ((article as any).images || []) as Array<{ attachmentId: string; bucket: string; objectKey: string }>
    const attachment = images.find((entry) => entry.attachmentId === attachmentId)
    if (!attachment) {
      return NextResponse.json({ success: false, message: 'Bild nicht gefunden' }, { status: 404 })
    }

    const expires = 60 * 60
    let url =
      typeof (minioClient as any).presignedGetObjectAsync === 'function'
        ? await (minioClient as any).presignedGetObjectAsync(attachment.bucket, attachment.objectKey, expires)
        : await new Promise<string>((resolve, reject) =>
            (minioClient as any).presignedGetObject(
              attachment.bucket,
              attachment.objectKey,
              expires,
              (err: unknown, signedUrl: string) => (err ? reject(err) : resolve(signedUrl))
            )
          )

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
    console.error('Presign-Artikelbild fehlgeschlagen:', error)
    return NextResponse.json(
      { success: false, message: 'Bild-URL konnte nicht erstellt werden' },
      { status: 500 }
    )
  }
}
