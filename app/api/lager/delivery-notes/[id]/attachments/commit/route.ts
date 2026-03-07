import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import dbConnect from '@/lib/dbConnect'
import { DeliveryNote } from '@/lib/models/DeliveryNote'
import { requireAuth } from '@/lib/security/requireAuth'
import { getCurrentUser } from '@/lib/auth/getCurrentUser'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await dbConnect()
    const auth = await requireAuth(request, ['lager', 'user', 'admin', 'superadmin'])
    if (!auth.ok) return NextResponse.json({ success: false, message: auth.error }, { status: auth.status })

    const csrf = request.headers.get('x-csrf-intent')
    if (process.env.NODE_ENV === 'production' && csrf !== 'lager:delivery-note:attachment:commit') {
      return NextResponse.json({ success: false, message: 'Ungültige Anforderung' }, { status: 400 })
    }

    const bodySchema = z.object({
      attachmentId: z.string().min(1),
      filename: z.string().min(1),
      contentType: z.string().min(1),
      size: z.number().min(1),
      bucket: z.string().min(1),
      objectKey: z.string().min(1),
      supplier: z.string().optional().default(''),
      reference: z.string().optional().default(''),
      noteDate: z.string().optional().default('')
    })
    const parseResult = bodySchema.safeParse(await request.json())
    if (!parseResult.success) {
      return NextResponse.json({ success: false, message: 'Validierungsfehler', issues: parseResult.error.flatten() }, { status: 400 })
    }
    const body = parseResult.data

    const { id } = await params
    const currentUser = await getCurrentUser(request)
    const attachment = {
      attachmentId: body.attachmentId,
      filename: body.filename,
      contentType: body.contentType,
      size: body.size,
      bucket: body.bucket,
      objectKey: body.objectKey,
      supplier: body.supplier,
      reference: body.reference,
      noteDate: body.noteDate ? new Date(body.noteDate) : undefined,
      uploadedBy: currentUser?._id
    }

    const updated = await DeliveryNote.findByIdAndUpdate(
      id,
      { $push: { attachments: attachment } },
      { new: true }
    ).lean()
    if (!updated) {
      return NextResponse.json({ success: false, message: 'Lieferschein nicht gefunden' }, { status: 404 })
    }

    return NextResponse.json({ success: true, attachment })
  } catch (error) {
    console.error('Commit-Lieferscheinanhang fehlgeschlagen:', error)
    return NextResponse.json({ success: false, message: 'Anhang konnte nicht gespeichert werden' }, { status: 500 })
  }
}
