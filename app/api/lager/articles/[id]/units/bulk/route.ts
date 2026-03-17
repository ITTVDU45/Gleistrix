import { NextRequest, NextResponse } from 'next/server'
import dbConnect from '@/lib/dbConnect'
import { Article } from '@/lib/models/Article'
import { ArticleUnit } from '@/lib/models/ArticleUnit'
import { requireAuth } from '@/lib/security/requireAuth'
import { generateArticleBarcode } from '@/lib/utils/barcode'
import { recalculateArticleStock } from '@/lib/utils/recalculateStock'
import mongoose from 'mongoose'
import { z } from 'zod'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect()
    const { id } = await params
    const csrf = request.headers.get('x-csrf-intent')
    if (process.env.NODE_ENV === 'production' && csrf !== 'lager:unit:bulk') {
      return NextResponse.json({ success: false, message: 'Ungültige Anforderung' }, { status: 400 })
    }
    const auth = await requireAuth(request, ['lager', 'user', 'admin', 'superadmin'])
    if (!auth.ok) return NextResponse.json({ success: false, message: auth.error }, { status: auth.status })

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, message: 'Ungültige Artikel-ID' }, { status: 400 })
    }

    const article = await Article.findById(id)
    if (!article) {
      return NextResponse.json({ success: false, message: 'Artikel nicht gefunden' }, { status: 404 })
    }

    const schema = z.object({
      units: z.array(z.object({
        seriennummer: z.string().min(1, 'Seriennummer ist erforderlich'),
        zustand: z.enum(['neu', 'gut', 'gebraucht', 'defekt']).optional().default('neu'),
        lagerort: z.string().optional().default('')
      })).min(1, 'Mindestens eine Unit erforderlich').max(1000, 'Maximal 1000 Units pro Anfrage')
    })

    const parseResult = schema.safeParse(await request.json())
    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, message: 'Validierungsfehler', issues: parseResult.error.flatten() },
        { status: 400 }
      )
    }

    const { units: unitData } = parseResult.data
    const serials = unitData.map(u => u.seriennummer)
    const uniqueSerials = new Set(serials)
    if (uniqueSerials.size !== serials.length) {
      return NextResponse.json(
        { success: false, message: 'Doppelte Seriennummern im Import gefunden' },
        { status: 400 }
      )
    }

    const existing = await ArticleUnit.find({
      artikelId: id,
      seriennummer: { $in: serials }
    }).lean()
    if (existing.length > 0) {
      const duplicates = existing.map((e: any) => e.seriennummer)
      return NextResponse.json(
        { success: false, message: `Folgende Seriennummern existieren bereits: ${duplicates.join(', ')}` },
        { status: 409 }
      )
    }

    const docs = unitData.map(u => ({
      artikelId: id,
      seriennummer: u.seriennummer,
      barcode: generateArticleBarcode(),
      status: 'verfuegbar',
      zustand: u.zustand,
      lagerort: u.lagerort || article.lagerort || '',
      notizen: ''
    }))

    const created = await ArticleUnit.insertMany(docs)
    const newStock = await recalculateArticleStock(id)

    return NextResponse.json({
      success: true,
      data: { created: created.length, bestand: newStock }
    }, { status: 201 })
  } catch (error: any) {
    if (error?.code === 11000) {
      return NextResponse.json(
        { success: false, message: 'Barcode-Kollision, bitte erneut versuchen' },
        { status: 409 }
      )
    }
    console.error('Fehler beim Bulk-Import:', error)
    return NextResponse.json({ success: false, message: 'Fehler beim Bulk-Import' }, { status: 500 })
  }
}
