import { NextRequest, NextResponse } from 'next/server'
import dbConnect from '@/lib/dbConnect'
import { Inventory } from '@/lib/models/Inventory'
import { Article } from '@/lib/models/Article'
import { getCurrentUser } from '@/lib/auth/getCurrentUser'
import { requireAuth } from '@/lib/security/requireAuth'
import mongoose from 'mongoose'
import { z } from 'zod'

export async function GET() {
  try {
    await dbConnect()
    const list = await Inventory.find({})
      .sort({ stichtag: -1 })
      .limit(100)
      .lean()
    return NextResponse.json({ success: true, inventory: list })
  } catch (error) {
    console.error('Fehler beim Laden der Inventuren:', error)
    return NextResponse.json(
      { success: false, message: 'Fehler beim Laden der Inventuren' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    await dbConnect()
    const csrf = request.headers.get('x-csrf-intent')
    if (process.env.NODE_ENV === 'production' && csrf !== 'lager:inventory:create') {
      return NextResponse.json({ success: false, message: 'Ungültige Anforderung' }, { status: 400 })
    }
    const auth = await requireAuth(request, ['user', 'admin', 'superadmin'])
    if (!auth.ok) return NextResponse.json({ success: false, message: auth.error }, { status: auth.status })

    const schema = z.object({
      typ: z.enum(['voll', 'teil']),
      stichtag: z.union([z.string(), z.date()]),
      kategorien: z.array(z.string()).optional().default([]),
      lagerorte: z.array(z.string()).optional().default([])
    }).passthrough()

    const parseResult = schema.safeParse(await request.json())
    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, message: 'Validierungsfehler', issues: parseResult.error.flatten() },
        { status: 400 }
      )
    }
    const body = parseResult.data
    const stichtag = typeof body.stichtag === 'string' ? new Date(body.stichtag) : body.stichtag

    const articleFilter: Record<string, unknown> = { status: 'aktiv' }
    if (body.typ === 'teil' && body.kategorien?.length) {
      articleFilter.kategorie = { $in: body.kategorien }
    }
    if (body.typ === 'teil' && body.lagerorte?.length) {
      articleFilter.lagerort = { $in: body.lagerorte }
    }
    const articles = await Article.find(articleFilter).select('_id bestand').lean()
    const positionen = articles.map((a: { _id: unknown; bestand?: number }) => ({
      artikelId: a._id,
      sollMenge: a.bestand ?? 0,
      istMenge: 0,
      differenz: 0
    }))

    const doc = await Inventory.create({
      typ: body.typ,
      stichtag,
      status: 'offen',
      kategorien: body.kategorien ?? [],
      lagerorte: body.lagerorte ?? [],
      positionen
    })
    const populated = await Inventory.findById(doc._id)
      .populate('positionen.artikelId', 'bezeichnung artikelnummer')
      .lean()
    return NextResponse.json({ success: true, data: populated ?? doc }, { status: 201 })
  } catch (error) {
    console.error('Fehler beim Anlegen der Inventur:', error)
    return NextResponse.json(
      { success: false, message: 'Fehler beim Anlegen der Inventur' },
      { status: 500 }
    )
  }
}
