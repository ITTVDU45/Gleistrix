import { NextRequest, NextResponse } from 'next/server'
import dbConnect from '@/lib/dbConnect'
import { ArticleUnit } from '@/lib/models/ArticleUnit'
import { requireAuth } from '@/lib/security/requireAuth'
import { recalculateArticleStock } from '@/lib/utils/recalculateStock'
import mongoose from 'mongoose'
import { z } from 'zod'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; unitId: string }> }
) {
  try {
    await dbConnect()
    const { id, unitId } = await params
    const auth = await requireAuth(request, ['lager', 'user', 'admin', 'superadmin'])
    if (!auth.ok) return NextResponse.json({ success: false, message: auth.error }, { status: auth.status })

    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(unitId)) {
      return NextResponse.json({ success: false, message: 'Ungültige ID' }, { status: 400 })
    }

    const unit = await ArticleUnit.findOne({ _id: unitId, artikelId: id }).lean()
    if (!unit) {
      return NextResponse.json({ success: false, message: 'Unit nicht gefunden' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: unit })
  } catch (error) {
    console.error('Fehler beim Laden der Unit:', error)
    return NextResponse.json({ success: false, message: 'Fehler beim Laden der Unit' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; unitId: string }> }
) {
  try {
    await dbConnect()
    const { id, unitId } = await params
    const csrf = request.headers.get('x-csrf-intent')
    if (process.env.NODE_ENV === 'production' && csrf !== 'lager:unit:update') {
      return NextResponse.json({ success: false, message: 'Ungültige Anforderung' }, { status: 400 })
    }
    const auth = await requireAuth(request, ['lager', 'user', 'admin', 'superadmin'])
    if (!auth.ok) return NextResponse.json({ success: false, message: auth.error }, { status: auth.status })

    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(unitId)) {
      return NextResponse.json({ success: false, message: 'Ungültige ID' }, { status: 400 })
    }

    const schema = z.object({
      seriennummer: z.string().min(1).optional(),
      zustand: z.enum(['neu', 'gut', 'gebraucht', 'defekt']).optional(),
      lagerort: z.string().optional(),
      notizen: z.string().optional(),
      status: z.enum(['verfuegbar', 'ausgegeben', 'in_wartung', 'defekt', 'archiviert']).optional()
    })

    const parseResult = schema.safeParse(await request.json())
    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, message: 'Validierungsfehler', issues: parseResult.error.flatten() },
        { status: 400 }
      )
    }

    const unit = await ArticleUnit.findOneAndUpdate(
      { _id: unitId, artikelId: id },
      parseResult.data,
      { new: true, runValidators: true }
    )

    if (!unit) {
      return NextResponse.json({ success: false, message: 'Unit nicht gefunden' }, { status: 404 })
    }

    await recalculateArticleStock(id)

    return NextResponse.json({ success: true, data: unit })
  } catch (error: any) {
    if (error?.code === 11000) {
      return NextResponse.json(
        { success: false, message: 'Eine Unit mit dieser Seriennummer existiert bereits' },
        { status: 409 }
      )
    }
    console.error('Fehler beim Aktualisieren der Unit:', error)
    return NextResponse.json({ success: false, message: 'Fehler beim Aktualisieren der Unit' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; unitId: string }> }
) {
  try {
    await dbConnect()
    const { id, unitId } = await params
    const csrf = request.headers.get('x-csrf-intent')
    if (process.env.NODE_ENV === 'production' && csrf !== 'lager:unit:delete') {
      return NextResponse.json({ success: false, message: 'Ungültige Anforderung' }, { status: 400 })
    }
    const auth = await requireAuth(request, ['lager', 'user', 'admin', 'superadmin'])
    if (!auth.ok) return NextResponse.json({ success: false, message: auth.error }, { status: auth.status })

    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(unitId)) {
      return NextResponse.json({ success: false, message: 'Ungültige ID' }, { status: 400 })
    }

    const unit = await ArticleUnit.findOneAndDelete({ _id: unitId, artikelId: id })
    if (!unit) {
      return NextResponse.json({ success: false, message: 'Unit nicht gefunden' }, { status: 404 })
    }

    await recalculateArticleStock(id)

    return NextResponse.json({ success: true, message: 'Unit gelöscht' })
  } catch (error) {
    console.error('Fehler beim Löschen der Unit:', error)
    return NextResponse.json({ success: false, message: 'Fehler beim Löschen der Unit' }, { status: 500 })
  }
}
