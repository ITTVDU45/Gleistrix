import { NextRequest, NextResponse } from 'next/server'
import dbConnect from '@/lib/dbConnect'
import { Inventory } from '@/lib/models/Inventory'
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
      return NextResponse.json({ success: false, message: 'Ungültige ID' }, { status: 400 })
    }
    const doc = await Inventory.findById(id)
      .populate('positionen.artikelId', 'bezeichnung artikelnummer bestand')
      .lean()
    if (!doc) {
      return NextResponse.json({ success: false, message: 'Inventur nicht gefunden' }, { status: 404 })
    }
    return NextResponse.json({ success: true, data: doc })
  } catch (error) {
    console.error('Fehler beim Laden der Inventur:', error)
    return NextResponse.json(
      { success: false, message: 'Fehler beim Laden der Inventur' },
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
    if (process.env.NODE_ENV === 'production' && csrf !== 'lager:inventory:update') {
      return NextResponse.json({ success: false, message: 'Ungültige Anforderung' }, { status: 400 })
    }
    const auth = await requireAuth(request, ['user', 'admin', 'superadmin'])
    if (!auth.ok) return NextResponse.json({ success: false, message: auth.error }, { status: auth.status })

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, message: 'Ungültige ID' }, { status: 400 })
    }

    const inv = await Inventory.findById(id)
    if (!inv) return NextResponse.json({ success: false, message: 'Inventur nicht gefunden' }, { status: 404 })
    if (inv.status === 'abgeschlossen') {
      return NextResponse.json({ success: false, message: 'Inventur bereits abgeschlossen' }, { status: 400 })
    }

    const schema = z.object({
      positionen: z.array(z.object({
        artikelId: z.string(),
        istMenge: z.number()
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
    const positionenMap = new Map(
      (inv.positionen as { artikelId: mongoose.Types.ObjectId; sollMenge: number }[]).map((p) => [
        (p.artikelId as mongoose.Types.ObjectId).toString(),
        p.sollMenge
      ])
    )
    const updatedPositionen = body.positionen.map((pos: { artikelId: string; istMenge: number }) => {
      const key = mongoose.Types.ObjectId.isValid(pos.artikelId) ? pos.artikelId : ''
      const sollMenge = positionenMap.get(key) ?? 0
      const istMenge = pos.istMenge
      const differenz = istMenge - sollMenge
      return {
        artikelId: new mongoose.Types.ObjectId(pos.artikelId),
        sollMenge,
        istMenge,
        differenz
      }
    })
    await Inventory.findByIdAndUpdate(id, {
      positionen: updatedPositionen,
      status: 'in_bearbeitung'
    })
    const doc = await Inventory.findById(id)
      .populate('positionen.artikelId', 'bezeichnung artikelnummer')
      .lean()
    return NextResponse.json({ success: true, data: doc })
  } catch (error) {
    console.error('Fehler beim Aktualisieren der Inventur:', error)
    return NextResponse.json(
      { success: false, message: 'Fehler beim Aktualisieren der Inventur' },
      { status: 500 }
    )
  }
}
