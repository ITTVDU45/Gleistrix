import { NextRequest, NextResponse } from 'next/server'
import dbConnect from '@/lib/dbConnect'
import { DeliveryNote } from '@/lib/models/DeliveryNote'
import { getCurrentUser } from '@/lib/auth/getCurrentUser'
import { requireAuth } from '@/lib/security/requireAuth'
import mongoose from 'mongoose'
import { z } from 'zod'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect()
    const { id } = await params
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, message: 'Ungueltige ID' }, { status: 400 })
    }
    const doc = await DeliveryNote.findById(id)
      .populate('positionen.artikelId', 'bezeichnung artikelnummer')
      .lean()
    if (!doc) {
      return NextResponse.json({ success: false, message: 'Lieferschein nicht gefunden' }, { status: 404 })
    }
    return NextResponse.json({ success: true, data: doc })
  } catch (error) {
    console.error('Fehler beim Laden des Lieferscheins:', error)
    return NextResponse.json(
      { success: false, message: 'Fehler beim Laden des Lieferscheins' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect()
    const { id } = await params
    const csrf = request.headers.get('x-csrf-intent')
    if (process.env.NODE_ENV === 'production' && csrf !== 'lager:delivery-note:update') {
      return NextResponse.json({ success: false, message: 'Ungueltige Anforderung' }, { status: 400 })
    }
    const auth = await requireAuth(request, ['lager', 'user', 'admin', 'superadmin'])
    if (!auth.ok) return NextResponse.json({ success: false, message: auth.error }, { status: auth.status })

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, message: 'Ungueltige ID' }, { status: 400 })
    }

    const schema = z.object({
      datum: z.union([z.string(), z.date()]).optional(),
      status: z.enum(['entwurf', 'abgeschlossen']).optional(),
      empfaenger: z.object({
        name: z.string().optional(),
        adresse: z.string().optional()
      }).optional()
    }).passthrough()

    const parseResult = schema.safeParse(await request.json())
    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, message: 'Validierungsfehler', issues: parseResult.error.flatten() },
        { status: 400 }
      )
    }

    const body = parseResult.data
    const update: Record<string, unknown> = {}

    if (body.datum !== undefined) {
      update.datum = typeof body.datum === 'string' ? new Date(body.datum) : body.datum
    }
    if (body.status !== undefined) {
      update.status = body.status
    }
    if (body.empfaenger !== undefined) {
      update.empfaenger = {
        name: body.empfaenger.name ?? '',
        adresse: body.empfaenger.adresse ?? ''
      }
    }

    const currentUser = await getCurrentUser(request)
    if (currentUser?._id) {
      update.verantwortlich = currentUser._id
    }

    const doc = await DeliveryNote.findByIdAndUpdate(id, update, { new: true, runValidators: true })
      .populate('positionen.artikelId', 'bezeichnung artikelnummer')
      .lean()

    if (!doc) {
      return NextResponse.json({ success: false, message: 'Lieferschein nicht gefunden' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: doc })
  } catch (error) {
    console.error('Fehler beim Aktualisieren des Lieferscheins:', error)
    return NextResponse.json(
      { success: false, message: 'Fehler beim Aktualisieren des Lieferscheins' },
      { status: 500 }
    )
  }
}
