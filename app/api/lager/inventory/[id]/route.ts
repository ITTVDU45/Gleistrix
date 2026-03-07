import { NextRequest, NextResponse } from 'next/server'
import dbConnect from '@/lib/dbConnect'
import { Inventory } from '@/lib/models/Inventory'
import { Article } from '@/lib/models/Article'
import { requireAuth } from '@/lib/security/requireAuth'
import mongoose from 'mongoose'
import { z } from 'zod'

function parseOptionalDate(value?: string | Date | null): Date | null {
  if (!value) return null
  const parsed = typeof value === 'string' ? new Date(value) : value
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function normalizeStringArray(values?: string[]): string[] {
  if (!Array.isArray(values)) return []
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)))
}

function normalizeObjectIdArray(values?: string[]): string[] {
  if (!Array.isArray(values)) return []
  return Array.from(
    new Set(values.filter((value) => mongoose.Types.ObjectId.isValid(value)))
  )
}

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
    const doc = await Inventory.findById(id)
      .populate('positionen.artikelId', 'bezeichnung artikelnummer barcode bestand')
      .lean()
    if (!doc) {
      return NextResponse.json({ success: false, message: 'Inventur nicht gefunden' }, { status: 404 })
    }
    return NextResponse.json({ success: true, data: doc }, { headers: { 'Cache-Control': 'no-store' } })
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
      return NextResponse.json({ success: false, message: 'Ungueltige Anforderung' }, { status: 400 })
    }
    const auth = await requireAuth(request, ['lager', 'user', 'admin', 'superadmin'])
    if (!auth.ok) return NextResponse.json({ success: false, message: auth.error }, { status: auth.status })

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, message: 'Ungueltige ID' }, { status: 400 })
    }

    const inv = await Inventory.findById(id)
    if (!inv) return NextResponse.json({ success: false, message: 'Inventur nicht gefunden' }, { status: 404 })
    if (inv.status === 'abgeschlossen') {
      return NextResponse.json({ success: false, message: 'Inventur bereits abgeschlossen' }, { status: 400 })
    }

    const schema = z.object({
      name: z.string().trim().max(120).optional(),
      beschreibung: z.string().trim().max(2000).optional(),
      typ: z.enum(['voll', 'teil']).optional(),
      stichtag: z.union([z.string(), z.date()]).optional(),
      zeitraumVon: z.union([z.string(), z.date()]).nullable().optional(),
      zeitraumBis: z.union([z.string(), z.date()]).nullable().optional(),
      kategorien: z.array(z.string()).optional(),
      artikelIds: z.array(z.string()).optional(),
      positionen: z.array(z.object({
        artikelId: z.string(),
        istMenge: z.number()
      })).optional()
    }).passthrough()

    const parseResult = schema.safeParse(await request.json())
    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, message: 'Validierungsfehler', issues: parseResult.error.flatten() },
        { status: 400 }
      )
    }

    const body = parseResult.data
    const updatePayload: Record<string, unknown> = {}

    if (typeof body.name === 'string') {
      const trimmedName = body.name.trim()
      if (!trimmedName) {
        return NextResponse.json({ success: false, message: 'Inventurname ist erforderlich' }, { status: 400 })
      }
      updatePayload.name = trimmedName
    }
    if (typeof body.beschreibung === 'string') {
      updatePayload.beschreibung = body.beschreibung.trim()
    }
    if (body.stichtag !== undefined) {
      const parsedStichtag = parseOptionalDate(body.stichtag)
      if (!parsedStichtag) {
        return NextResponse.json({ success: false, message: 'Ungueltiger Stichtag' }, { status: 400 })
      }
      updatePayload.stichtag = parsedStichtag
    }
    if (body.zeitraumVon !== undefined) {
      updatePayload.zeitraumVon = parseOptionalDate(body.zeitraumVon)
    }
    if (body.zeitraumBis !== undefined) {
      updatePayload.zeitraumBis = parseOptionalDate(body.zeitraumBis)
    }

    const finalVon = (updatePayload.zeitraumVon as Date | null | undefined) ?? (inv.zeitraumVon as Date | null | undefined) ?? null
    const finalBis = (updatePayload.zeitraumBis as Date | null | undefined) ?? (inv.zeitraumBis as Date | null | undefined) ?? null
    if (finalVon && finalBis && finalBis < finalVon) {
      return NextResponse.json(
        { success: false, message: 'Zeitraum-Ende darf nicht vor Zeitraum-Beginn liegen' },
        { status: 400 }
      )
    }

    const positionOverrides = new Map<string, number>()
    if (body.positionen) {
      body.positionen
        .filter((pos: { artikelId: string }) => mongoose.Types.ObjectId.isValid(pos.artikelId))
        .forEach((pos: { artikelId: string; istMenge: number }) => {
          positionOverrides.set(pos.artikelId, pos.istMenge)
        })
    }

    const focusChanged = body.typ !== undefined || body.kategorien !== undefined || body.artikelIds !== undefined

    if (focusChanged) {
      const nextTyp = body.typ ?? inv.typ
      let nextKategorien = body.kategorien !== undefined
        ? normalizeStringArray(body.kategorien)
        : normalizeStringArray(((inv as any).kategorien ?? []) as string[])
      let nextArtikelIds = body.artikelIds !== undefined
        ? normalizeObjectIdArray(body.artikelIds)
        : normalizeObjectIdArray((((inv as any).artikelIds ?? []) as Array<string | mongoose.Types.ObjectId>).map((value) => String(value)))

      if (nextTyp === 'voll') {
        nextKategorien = []
        nextArtikelIds = []
      } else if (nextKategorien.length === 0 && nextArtikelIds.length === 0) {
        return NextResponse.json(
          { success: false, message: 'Bitte mindestens eine Kategorie oder ein Produkt fuer den Fokus auswaehlen' },
          { status: 400 }
        )
      }

      const articleFilter: Record<string, unknown> = { status: 'aktiv' }
      if (nextTyp === 'teil' && nextKategorien.length) {
        articleFilter.kategorie = { $in: nextKategorien }
      }
      if (nextTyp === 'teil' && nextArtikelIds.length) {
        articleFilter._id = { $in: nextArtikelIds.map((articleId) => new mongoose.Types.ObjectId(articleId)) }
      }

      const scopedArticles = await Article.find(articleFilter).select('_id bestand').lean()
      if (nextTyp === 'teil' && scopedArticles.length === 0) {
        return NextResponse.json(
          { success: false, message: 'Keine aktiven Produkte fuer den ausgewaehlten Fokus gefunden' },
          { status: 400 }
        )
      }

      const existingIstByArticle = new Map<string, number>()
      ;((inv.positionen ?? []) as Array<{ artikelId: mongoose.Types.ObjectId; istMenge?: number }>).forEach((position) => {
        const key = String(position.artikelId)
        existingIstByArticle.set(key, Number(position.istMenge ?? 0))
      })

      const recomputedPositionen = scopedArticles.map((article: { _id: unknown; bestand?: number }) => {
        const articleId = String(article._id)
        const sollMenge = Number(article.bestand ?? 0)
        const istMenge = positionOverrides.has(articleId)
          ? Number(positionOverrides.get(articleId) ?? 0)
          : Number(existingIstByArticle.get(articleId) ?? 0)
        const differenz = istMenge - sollMenge
        return {
          artikelId: new mongoose.Types.ObjectId(articleId),
          sollMenge,
          istMenge,
          differenz
        }
      })

      updatePayload.typ = nextTyp
      updatePayload.kategorien = nextKategorien
      updatePayload.artikelIds = nextArtikelIds.map((articleId) => new mongoose.Types.ObjectId(articleId))
      updatePayload.positionen = recomputedPositionen
      if (body.positionen && inv.status === 'offen') {
        updatePayload.status = 'in_bearbeitung'
      }
    } else if (body.positionen) {
      const positionenMap = new Map(
        (inv.positionen as { artikelId: mongoose.Types.ObjectId; sollMenge: number }[]).map((p) => [
          (p.artikelId as mongoose.Types.ObjectId).toString(),
          p.sollMenge
        ])
      )
      const updatedPositionen = body.positionen
        .filter((pos: { artikelId: string }) => mongoose.Types.ObjectId.isValid(pos.artikelId))
        .map((pos: { artikelId: string; istMenge: number }) => {
          const sollMenge = positionenMap.get(pos.artikelId) ?? 0
          const istMenge = pos.istMenge
          const differenz = istMenge - sollMenge
          return {
            artikelId: new mongoose.Types.ObjectId(pos.artikelId),
            sollMenge,
            istMenge,
            differenz
          }
        })
      updatePayload.positionen = updatedPositionen
      updatePayload.status = 'in_bearbeitung'
    }

    const doc = await Inventory.findByIdAndUpdate(id, updatePayload, {
      new: true,
      runValidators: true
    })
      .populate('positionen.artikelId', 'bezeichnung artikelnummer barcode')
      .lean()
    return NextResponse.json({ success: true, data: doc }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('Fehler beim Aktualisieren der Inventur:', error)
    return NextResponse.json(
      { success: false, message: 'Fehler beim Aktualisieren der Inventur' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect()
    const { id } = await params
    const csrf = request.headers.get('x-csrf-intent')
    if (process.env.NODE_ENV === 'production' && csrf !== 'lager:inventory:delete') {
      return NextResponse.json({ success: false, message: 'Ungueltige Anforderung' }, { status: 400 })
    }
    const auth = await requireAuth(request, ['lager', 'admin', 'superadmin'])
    if (!auth.ok) return NextResponse.json({ success: false, message: auth.error }, { status: auth.status })

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, message: 'Ungueltige ID' }, { status: 400 })
    }

    const deleted = await Inventory.findByIdAndDelete(id)
    if (!deleted) {
      return NextResponse.json({ success: false, message: 'Inventur nicht gefunden' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Fehler beim Loeschen der Inventur:', error)
    return NextResponse.json(
      { success: false, message: 'Fehler beim Loeschen der Inventur' },
      { status: 500 }
    )
  }
}
