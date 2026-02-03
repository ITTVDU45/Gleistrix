import { NextRequest, NextResponse } from 'next/server'
import dbConnect from '@/lib/dbConnect'
import { Maintenance } from '@/lib/models/Maintenance'
import { Article } from '@/lib/models/Article'
import { getCurrentUser } from '@/lib/auth/getCurrentUser'
import { requireAuth } from '@/lib/security/requireAuth'
import mongoose from 'mongoose'
import { z } from 'zod'

const statusEnum = ['geplant', 'faellig', 'durchgefuehrt', 'nicht_bestanden'] as const

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect()
    const { id } = await params
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, message: 'Ungültige ID' }, { status: 400 })
    }
    const doc = await Maintenance.findById(id).populate('artikelId', 'bezeichnung artikelnummer').lean()
    if (!doc) return NextResponse.json({ success: false, message: 'Wartung nicht gefunden' }, { status: 404 })
    return NextResponse.json({ success: true, data: doc })
  } catch (error) {
    console.error('Fehler beim Laden der Wartung:', error)
    return NextResponse.json(
      { success: false, message: 'Fehler beim Laden der Wartung' },
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
    if (process.env.NODE_ENV === 'production' && csrf !== 'lager:maintenance:update') {
      return NextResponse.json({ success: false, message: 'Ungültige Anforderung' }, { status: 400 })
    }
    const auth = await requireAuth(request, ['user', 'admin', 'superadmin'])
    if (!auth.ok) return NextResponse.json({ success: false, message: auth.error }, { status: auth.status })

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, message: 'Ungültige ID' }, { status: 400 })
    }

    const schema = z.object({
      durchfuehrungsdatum: z.union([z.string(), z.date(), z.null()]).optional(),
      status: z.enum(statusEnum).optional(),
      ergebnis: z.string().optional().or(z.literal('')),
      naechsterTermin: z.union([z.string(), z.date(), z.null()]).optional()
    }).passthrough()

    const parseResult = schema.safeParse(await request.json())
    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, message: 'Validierungsfehler', issues: parseResult.error.flatten() },
        { status: 400 }
      )
    }
    const body = parseResult.data as Record<string, unknown>
    const update: Record<string, unknown> = {}
    if (body.durchfuehrungsdatum !== undefined) {
      update.durchfuehrungsdatum = body.durchfuehrungsdatum
        ? (typeof body.durchfuehrungsdatum === 'string' ? new Date(body.durchfuehrungsdatum) : body.durchfuehrungsdatum)
        : null
    }
    if (body.status !== undefined) update.status = body.status
    if (body.ergebnis !== undefined) update.ergebnis = body.ergebnis
    if (body.naechsterTermin !== undefined) {
      update.naechsterTermin = body.naechsterTermin
        ? (typeof body.naechsterTermin === 'string' ? new Date(body.naechsterTermin) : body.naechsterTermin)
        : null
    }
    const currentUser = await getCurrentUser(request)
    if (currentUser) update.durchgefuehrtVon = currentUser._id

    const doc = await Maintenance.findByIdAndUpdate(id, update, { new: true, runValidators: true })
      .populate('artikelId', 'bezeichnung artikelnummer')
      .lean()
    if (!doc) return NextResponse.json({ success: false, message: 'Wartung nicht gefunden' }, { status: 404 })

    if (body.status === 'nicht_bestanden') {
      const aid = (doc as { artikelId?: { _id?: unknown } | unknown }).artikelId
      const id = aid && typeof aid === 'object' && '_id' in aid ? (aid as { _id: unknown })._id : aid
      if (id) await Article.findByIdAndUpdate(id, { status: 'gesperrt' })
    }
    return NextResponse.json({ success: true, data: doc })
  } catch (error) {
    console.error('Fehler beim Aktualisieren der Wartung:', error)
    return NextResponse.json(
      { success: false, message: 'Fehler beim Aktualisieren der Wartung' },
      { status: 500 }
    )
  }
}
