import { NextRequest, NextResponse } from 'next/server'
import dbConnect from '@/lib/dbConnect'
import { Maintenance } from '@/lib/models/Maintenance'
import { getCurrentUser } from '@/lib/auth/getCurrentUser'
import { requireAuth } from '@/lib/security/requireAuth'
import mongoose from 'mongoose'
import { z } from 'zod'

const statusEnum = ['geplant', 'faellig', 'durchgefuehrt', 'nicht_bestanden'] as const

export async function GET(request: NextRequest) {
  try {
    await dbConnect()
    const { searchParams } = new URL(request.url)
    const artikelId = searchParams.get('artikelId') ?? undefined
    const status = searchParams.get('status') ?? undefined

    const filter: Record<string, unknown> = {}
    if (artikelId && mongoose.Types.ObjectId.isValid(artikelId)) filter.artikelId = new mongoose.Types.ObjectId(artikelId)
    if (status) filter.status = status

    const list = await Maintenance.find(filter)
      .sort({ faelligkeitsdatum: 1 })
      .limit(500)
      .populate('artikelId', 'bezeichnung artikelnummer')
      .lean()
    return NextResponse.json({ success: true, maintenance: list })
  } catch (error) {
    console.error('Fehler beim Laden der Wartungen:', error)
    return NextResponse.json(
      { success: false, message: 'Fehler beim Laden der Wartungen' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    await dbConnect()
    const csrf = request.headers.get('x-csrf-intent')
    if (process.env.NODE_ENV === 'production' && csrf !== 'lager:maintenance:create') {
      return NextResponse.json({ success: false, message: 'Ungültige Anforderung' }, { status: 400 })
    }
    const auth = await requireAuth(request, ['user', 'admin', 'superadmin'])
    if (!auth.ok) return NextResponse.json({ success: false, message: auth.error }, { status: auth.status })

    const schema = z.object({
      artikelId: z.string().min(1),
      wartungsart: z.string().min(1),
      faelligkeitsdatum: z.union([z.string(), z.date()]),
      status: z.enum(statusEnum).optional().default('geplant')
    }).passthrough()

    const parseResult = schema.safeParse(await request.json())
    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, message: 'Validierungsfehler', issues: parseResult.error.flatten() },
        { status: 400 }
      )
    }
    const body = parseResult.data
    const artikelId = body.artikelId
    if (!mongoose.Types.ObjectId.isValid(artikelId)) {
      return NextResponse.json({ success: false, message: 'Ungültige Artikel-ID' }, { status: 400 })
    }

    const faelligkeitsdatum = typeof body.faelligkeitsdatum === 'string' ? new Date(body.faelligkeitsdatum) : body.faelligkeitsdatum
    const doc = await Maintenance.create({
      artikelId: new mongoose.Types.ObjectId(artikelId),
      wartungsart: body.wartungsart,
      faelligkeitsdatum,
      status: body.status ?? 'geplant'
    })
    const populated = await Maintenance.findById(doc._id).populate('artikelId', 'bezeichnung').lean()
    return NextResponse.json({ success: true, data: populated ?? doc }, { status: 201 })
  } catch (error) {
    console.error('Fehler beim Anlegen der Wartung:', error)
    return NextResponse.json(
      { success: false, message: 'Fehler beim Anlegen der Wartung' },
      { status: 500 }
    )
  }
}
