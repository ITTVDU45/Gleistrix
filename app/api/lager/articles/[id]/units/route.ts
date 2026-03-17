import { NextRequest, NextResponse } from 'next/server'
import dbConnect from '@/lib/dbConnect'
import { Article } from '@/lib/models/Article'
import { ArticleUnit } from '@/lib/models/ArticleUnit'
import { requireAuth } from '@/lib/security/requireAuth'
import { generateArticleBarcode } from '@/lib/utils/barcode'
import { recalculateArticleStock } from '@/lib/utils/recalculateStock'
import mongoose from 'mongoose'
import { z } from 'zod'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect()
    const { id } = await params
    const auth = await requireAuth(request, ['lager', 'user', 'admin', 'superadmin'])
    if (!auth.ok) return NextResponse.json({ success: false, message: auth.error }, { status: auth.status })

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, message: 'Ungültige Artikel-ID' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') ?? undefined

    const filter: Record<string, unknown> = { artikelId: id }
    if (status) filter.status = status

    const units = await ArticleUnit.find(filter).sort({ seriennummer: 1 }).lean()
    return NextResponse.json({ success: true, units })
  } catch (error) {
    console.error('Fehler beim Laden der Units:', error)
    return NextResponse.json({ success: false, message: 'Fehler beim Laden der Units' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect()
    const { id } = await params
    const csrf = request.headers.get('x-csrf-intent')
    if (process.env.NODE_ENV === 'production' && csrf !== 'lager:unit:create') {
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
      seriennummer: z.string().min(1, 'Seriennummer ist erforderlich'),
      zustand: z.enum(['neu', 'gut', 'gebraucht', 'defekt']).optional().default('neu'),
      lagerort: z.string().optional().default(''),
      notizen: z.string().optional().default(''),
      status: z.enum(['verfuegbar', 'ausgegeben', 'in_wartung', 'defekt', 'archiviert']).optional().default('verfuegbar')
    })

    const parseResult = schema.safeParse(await request.json())
    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, message: 'Validierungsfehler', issues: parseResult.error.flatten() },
        { status: 400 }
      )
    }

    const data = parseResult.data
    const barcode = generateArticleBarcode()

    const unit = await ArticleUnit.create({
      artikelId: id,
      seriennummer: data.seriennummer,
      barcode,
      status: data.status,
      zustand: data.zustand,
      lagerort: data.lagerort || article.lagerort || '',
      notizen: data.notizen
    })

    await recalculateArticleStock(id)

    return NextResponse.json({ success: true, data: unit }, { status: 201 })
  } catch (error: any) {
    if (error?.code === 11000) {
      return NextResponse.json(
        { success: false, message: 'Eine Unit mit dieser Seriennummer existiert bereits für diesen Artikel' },
        { status: 409 }
      )
    }
    console.error('Fehler beim Anlegen der Unit:', error)
    return NextResponse.json({ success: false, message: 'Fehler beim Anlegen der Unit' }, { status: 500 })
  }
}
