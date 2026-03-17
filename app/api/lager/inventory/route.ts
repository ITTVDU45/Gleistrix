import { NextRequest, NextResponse } from 'next/server'
import mongoose from 'mongoose'
import dbConnect from '@/lib/dbConnect'
import { Inventory } from '@/lib/models/Inventory'
import { Article } from '@/lib/models/Article'
import { ArticleUnit } from '@/lib/models/ArticleUnit'
import { requireAuth } from '@/lib/security/requireAuth'
import { z } from 'zod'

function parseOptionalDate(value?: string | Date | null): Date | null {
  if (!value) return null
  const parsed = typeof value === 'string' ? new Date(value) : value
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)))
}

export async function GET() {
  try {
    await dbConnect()
    const list = await Inventory.find({})
      .sort({ createdAt: -1 })
      .limit(100)
      .lean()
    return NextResponse.json({ success: true, inventory: list }, { headers: { 'Cache-Control': 'no-store' } })
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
      return NextResponse.json({ success: false, message: 'Ungueltige Anforderung' }, { status: 400 })
    }
    const auth = await requireAuth(request, ['lager', 'user', 'admin', 'superadmin'])
    if (!auth.ok) return NextResponse.json({ success: false, message: auth.error }, { status: auth.status })

    const schema = z.object({
      name: z.string().trim().min(1, 'Inventurname ist erforderlich').max(120),
      beschreibung: z.string().trim().max(2000).optional(),
      typ: z.enum(['voll', 'teil']).default('voll'),
      stichtag: z.union([z.string(), z.date()]).optional(),
      zeitraumVon: z.union([z.string(), z.date()]).optional(),
      zeitraumBis: z.union([z.string(), z.date()]).optional(),
      artikelIds: z.array(z.string()).optional().default([]),
      kategorien: z.array(z.string()).optional().default([]),
      lagerorte: z.array(z.string()).optional().default([]),
      unitIds: z.array(z.string()).optional().default([])
    }).passthrough()

    const parseResult = schema.safeParse(await request.json())
    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, message: 'Validierungsfehler', issues: parseResult.error.flatten() },
        { status: 400 }
      )
    }

    const body = parseResult.data
    const stichtag = parseOptionalDate(body.stichtag) ?? new Date()
    const zeitraumVon = parseOptionalDate(body.zeitraumVon)
    const zeitraumBis = parseOptionalDate(body.zeitraumBis)
    const kategorien = uniqueStrings(body.kategorien ?? [])
    const lagerorte = uniqueStrings(body.lagerorte ?? [])
    const artikelIdStrings = uniqueStrings(
      (body.artikelIds ?? []).filter((value) => mongoose.Types.ObjectId.isValid(value))
    )

    if (zeitraumVon && zeitraumBis && zeitraumBis < zeitraumVon) {
      return NextResponse.json(
        { success: false, message: 'Zeitraum-Ende darf nicht vor Zeitraum-Beginn liegen' },
        { status: 400 }
      )
    }

    if (body.typ === 'teil' && artikelIdStrings.length === 0 && kategorien.length === 0 && lagerorte.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Bitte mindestens eine Kategorie oder ein Produkt fuer den Fokus auswaehlen' },
        { status: 400 }
      )
    }

    const articleFilter: Record<string, unknown> = { status: 'aktiv' }
    if (body.typ === 'teil' && kategorien.length) {
      articleFilter.kategorie = { $in: kategorien }
    }
    if (body.typ === 'teil' && lagerorte.length) {
      articleFilter.lagerort = { $in: lagerorte }
    }
    if (body.typ === 'teil' && artikelIdStrings.length) {
      articleFilter._id = { $in: artikelIdStrings.map((id) => new mongoose.Types.ObjectId(id)) }
    }

    const articles = await Article.find(articleFilter).select('_id bestand serialTracking').lean()
    if (body.typ === 'teil' && articles.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Keine aktiven Produkte fuer den ausgewaehlten Fokus gefunden' },
        { status: 400 }
      )
    }

    const validUnitIds = uniqueStrings(
      (body.unitIds ?? []).filter((v) => mongoose.Types.ObjectId.isValid(v))
    )

    let unitsByArticle: Record<string, mongoose.Types.ObjectId[]> = {}
    if (validUnitIds.length > 0) {
      const units = await ArticleUnit.find({
        _id: { $in: validUnitIds.map((id) => new mongoose.Types.ObjectId(id)) }
      }).select('_id artikelId').lean()
      for (const u of units) {
        const artKey = String(u.artikelId)
        if (!unitsByArticle[artKey]) unitsByArticle[artKey] = []
        unitsByArticle[artKey].push(u._id as mongoose.Types.ObjectId)
      }
    }

    const positionen = articles.map((a: { _id: unknown; bestand?: number; serialTracking?: string }) => {
      const artIdStr = String(a._id)
      const selectedUnits = unitsByArticle[artIdStr]
      if (selectedUnits && selectedUnits.length > 0) {
        return {
          artikelId: a._id,
          sollMenge: selectedUnits.length,
          istMenge: 0,
          differenz: -selectedUnits.length,
          unitIds: selectedUnits
        }
      }
      return {
        artikelId: a._id,
        sollMenge: a.bestand ?? 0,
        istMenge: 0,
        differenz: 0
      }
    })

    const doc = await Inventory.create({
      name: body.name.trim(),
      beschreibung: body.beschreibung?.trim() ?? '',
      typ: body.typ,
      stichtag,
      zeitraumVon,
      zeitraumBis,
      status: 'offen',
      artikelIds: artikelIdStrings.map((id) => new mongoose.Types.ObjectId(id)),
      kategorien,
      lagerorte,
      positionen
    })

    const populated = await Inventory.findById(doc._id)
      .populate('positionen.artikelId', 'bezeichnung artikelnummer barcode')
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
