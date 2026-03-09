import { NextRequest, NextResponse } from 'next/server'
import dbConnect from '@/lib/dbConnect'
import { DeliveryNote } from '@/lib/models/DeliveryNote'
import { getCurrentUser } from '@/lib/auth/getCurrentUser'
import { requireAuth } from '@/lib/security/requireAuth'
import mongoose from 'mongoose'
import { z } from 'zod'
import { getNextDeliveryNoteNumber } from '@/lib/utils/deliveryNoteNumber'

export async function GET(request: NextRequest) {
  try {
    await dbConnect()
    const auth = await requireAuth(request, ['lager', 'user', 'admin', 'superadmin'])
    if (!auth.ok) return NextResponse.json({ success: false, message: auth.error }, { status: auth.status })

    const { searchParams } = new URL(request.url)
    const typ = searchParams.get('typ') ?? ''
    const status = searchParams.get('status') ?? ''
    const search = (searchParams.get('search') ?? '').trim()
    const dateFrom = searchParams.get('dateFrom') ?? ''
    const dateTo = searchParams.get('dateTo') ?? ''
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1)
    const limit = Math.min(500, Math.max(1, parseInt(searchParams.get('limit') ?? '200', 10) || 200))

    const filter: Record<string, unknown> = {}
    if (typ === 'eingang' || typ === 'ausgang') filter.typ = typ
    if (status === 'entwurf' || status === 'abgeschlossen') filter.status = status
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const regex = new RegExp(escaped, 'i')
      filter.$or = [{ nummer: regex }, { 'empfaenger.name': regex }]
    }
    if (dateFrom || dateTo) {
      const datumFilter: Record<string, Date> = {}
      if (dateFrom) datumFilter.$gte = new Date(dateFrom)
      if (dateTo) datumFilter.$lte = new Date(dateTo)
      filter.datum = datumFilter
    }

    const skip = (page - 1) * limit
    const list = await DeliveryNote.find(filter)
      .sort({ datum: -1, nummer: -1 })
      .skip(skip)
      .limit(limit)
      .lean()

    return NextResponse.json({ success: true, deliveryNotes: list, page, limit })
  } catch (error) {
    console.error('Fehler beim Laden der Lieferscheine:', error)
    return NextResponse.json(
      { success: false, message: 'Fehler beim Laden der Lieferscheine' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    await dbConnect()
    const csrf = request.headers.get('x-csrf-intent')
    if (process.env.NODE_ENV === 'production' && csrf !== 'lager:delivery-note:create') {
      return NextResponse.json({ success: false, message: 'Ungueltige Anforderung' }, { status: 400 })
    }
    const auth = await requireAuth(request, ['lager', 'user', 'admin', 'superadmin'])
    if (!auth.ok) return NextResponse.json({ success: false, message: auth.error }, { status: auth.status })

    const schema = z.object({
      typ: z.enum(['eingang', 'ausgang']),
      datum: z.union([z.string(), z.date()]),
      empfaenger: z.object({
        name: z.string(),
        adresse: z.string().optional().or(z.literal(''))
      }),
      positionen: z.array(z.object({
        artikelId: z.string(),
        bezeichnung: z.string(),
        menge: z.number(),
        seriennummer: z.string().optional().or(z.literal(''))
      }))
    }).passthrough()

    const parseResult = schema.safeParse(await request.json())
    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, message: 'Validierungsfehler', issues: parseResult.error.flatten() },
        { status: 400 }
      )
    }
    const body = parseResult.data
    const currentUser = await getCurrentUser(request)
    const nummer = await getNextDeliveryNoteNumber()
    const datum = typeof body.datum === 'string' ? new Date(body.datum) : body.datum

    const positionen = body.positionen.map((p: { artikelId: string; bezeichnung: string; menge: number; seriennummer?: string }) => ({
      artikelId: mongoose.Types.ObjectId.isValid(p.artikelId) ? new mongoose.Types.ObjectId(p.artikelId) : undefined,
      bezeichnung: p.bezeichnung,
      menge: p.menge,
      seriennummer: p.seriennummer ?? ''
    }))

    const doc = await DeliveryNote.create({
      typ: body.typ,
      nummer,
      datum,
      empfaenger: body.empfaenger,
      positionen,
      verantwortlich: currentUser?._id,
      status: 'abgeschlossen'
    })

    if (currentUser) {
      try {
        const ActivityLogModel = (await import('@/lib/models/ActivityLog')).default
        await ActivityLogModel.create({
          timestamp: new Date(),
          actionType: 'lager_delivery_note_created',
          module: 'lager',
          performedBy: {
            userId: currentUser._id,
            name: currentUser.name ?? '',
            role: currentUser.role ?? 'user'
          },
          details: {
            entityId: doc._id,
            description: `Lieferschein ${nummer} (${body.typ}) erstellt`,
            after: { nummer, typ: body.typ }
          }
        })
      } catch (logErr) {
        console.error('ActivityLog Fehler:', logErr)
      }
    }

    return NextResponse.json({ success: true, data: doc }, { status: 201 })
  } catch (error) {
    console.error('Fehler beim Anlegen des Lieferscheins:', error)
    return NextResponse.json(
      { success: false, message: 'Fehler beim Anlegen des Lieferscheins' },
      { status: 500 }
    )
  }
}
