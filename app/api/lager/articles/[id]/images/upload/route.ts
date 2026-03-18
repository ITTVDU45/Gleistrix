import { NextRequest, NextResponse } from 'next/server'
import { nanoid } from 'nanoid'
import dbConnect from '@/lib/dbConnect'
import { Article } from '@/lib/models/Article'
import { requireAuth } from '@/lib/security/requireAuth'
import minioClient, { getArticleImageObjectKey } from '@/lib/storage/minioClient'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect()
    const auth = await requireAuth(request, ['lager', 'user', 'admin', 'superadmin'])
    if (!auth.ok) return NextResponse.json({ success: false, message: auth.error }, { status: auth.status })

    const csrf = request.headers.get('x-csrf-intent')
    if (process.env.NODE_ENV === 'production' && csrf !== 'lager:article:image:upload') {
      return NextResponse.json({ success: false, message: 'Ungueltige Anforderung' }, { status: 400 })
    }

    const { id } = await params
    const article = await Article.findById(id).lean()
    if (!article) {
      return NextResponse.json({ success: false, message: 'Artikel nicht gefunden' }, { status: 404 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ success: false, message: 'Keine Datei gesendet' }, { status: 400 })
    }

    const maxSize = 10 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json({ success: false, message: 'Datei zu gross (max. 10 MB)' }, { status: 400 })
    }

    const bucket = process.env.MINIO_BUCKET || 'project-documents'
    const attachmentId = nanoid(14)
    const safeFilename = file.name.replace(/[^a-zA-Z0-9-_.]/g, '_')
    const objectKey = getArticleImageObjectKey(id, `${attachmentId}-${safeFilename}`)
    const contentType = file.type || 'image/jpeg'

    const buffer = Buffer.from(await file.arrayBuffer())

    await minioClient.putObject(bucket, objectKey, buffer, buffer.length, { 'Content-Type': contentType })

    const attachment = {
      attachmentId,
      filename: file.name,
      bucket,
      objectKey,
      contentType,
      createdAt: new Date()
    }

    const updated = await Article.findByIdAndUpdate(
      id,
      { $push: { images: attachment } },
      { new: true }
    ).lean()

    if (!updated) {
      return NextResponse.json({ success: false, message: 'Artikel nicht gefunden' }, { status: 404 })
    }

    return NextResponse.json({ success: true, attachment }, { status: 201 })
  } catch (error) {
    console.error('Artikelbild-Upload fehlgeschlagen:', error)
    return NextResponse.json(
      { success: false, message: 'Bild-Upload fehlgeschlagen' },
      { status: 500 }
    )
  }
}
