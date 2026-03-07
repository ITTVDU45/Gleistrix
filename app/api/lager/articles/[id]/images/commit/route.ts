import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import dbConnect from '@/lib/dbConnect'
import { Article } from '@/lib/models/Article'
import { requireAuth } from '@/lib/security/requireAuth'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect()
    const auth = await requireAuth(request, ['lager', 'user', 'admin', 'superadmin'])
    if (!auth.ok) return NextResponse.json({ success: false, message: auth.error }, { status: auth.status })

    const csrf = request.headers.get('x-csrf-intent')
    if (process.env.NODE_ENV === 'production' && csrf !== 'lager:article:image:commit') {
      return NextResponse.json({ success: false, message: 'Ungültige Anforderung' }, { status: 400 })
    }

    const bodySchema = z.object({
      attachmentId: z.string().min(1),
      filename: z.string().min(1),
      contentType: z.string().min(1),
      size: z.number().min(1),
      bucket: z.string().min(1),
      objectKey: z.string().min(1)
    })
    const parseResult = bodySchema.safeParse(await request.json())
    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, message: 'Validierungsfehler', issues: parseResult.error.flatten() },
        { status: 400 }
      )
    }
    const body = parseResult.data
    const { id } = await params
    const attachment = {
      attachmentId: body.attachmentId,
      filename: body.filename,
      bucket: body.bucket,
      objectKey: body.objectKey,
      contentType: body.contentType,
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

    return NextResponse.json({ success: true, attachment })
  } catch (error) {
    console.error('Commit-Artikelbild fehlgeschlagen:', error)
    return NextResponse.json(
      { success: false, message: 'Bild konnte nicht gespeichert werden' },
      { status: 500 }
    )
  }
}
