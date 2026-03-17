import { NextRequest, NextResponse } from 'next/server'
import dbConnect from '@/lib/dbConnect'
import { Article } from '@/lib/models/Article'
import { requireAuth } from '@/lib/security/requireAuth'
import { removeObject, getObjectBufferAsync } from '@/lib/storage/minioClient'

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

    const images = ((article as any).images || []) as Array<{ attachmentId: string; bucket: string; objectKey: string; contentType?: string }>
    const attachment = images.find((entry) => entry.attachmentId === attachmentId)
    if (!attachment) {
      return NextResponse.json({ success: false, message: 'Bild nicht gefunden' }, { status: 404 })
    }

    const buffer = await getObjectBufferAsync(attachment.bucket, attachment.objectKey)
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': attachment.contentType || 'image/jpeg',
        'Cache-Control': 'public, max-age=3600, immutable'
      }
    })
  } catch (error) {
    console.error('Artikelbild laden fehlgeschlagen:', error)
    return NextResponse.json(
      { success: false, message: 'Bild konnte nicht geladen werden' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  try {
    await dbConnect()
    const auth = await requireAuth(request, ['lager', 'user', 'admin', 'superadmin'])
    if (!auth.ok) return NextResponse.json({ success: false, message: auth.error }, { status: auth.status })

    const csrf = request.headers.get('x-csrf-intent')
    if (process.env.NODE_ENV === 'production' && csrf !== 'lager:article:image:delete') {
      return NextResponse.json({ success: false, message: 'Ungültige Anforderung' }, { status: 400 })
    }

    const { id, attachmentId } = await params
    const article = await Article.findById(id)
    if (!article) {
      return NextResponse.json({ success: false, message: 'Artikel nicht gefunden' }, { status: 404 })
    }

    const images = ((article as any).images || []) as Array<{ attachmentId: string; bucket: string; objectKey: string }>
    const found = images.find((entry) => entry.attachmentId === attachmentId)
    if (!found) {
      return NextResponse.json({ success: false, message: 'Bild nicht gefunden' }, { status: 404 })
    }

    try {
      await removeObject(found.bucket, found.objectKey)
    } catch (storageError) {
      console.warn('MinIO removeObject fehlgeschlagen:', storageError)
    }

    await Article.findByIdAndUpdate(id, { $pull: { images: { attachmentId } } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Löschen Artikelbild fehlgeschlagen:', error)
    return NextResponse.json(
      { success: false, message: 'Bild konnte nicht gelöscht werden' },
      { status: 500 }
    )
  }
}
