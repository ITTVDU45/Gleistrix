import { NextRequest, NextResponse } from 'next/server'
import dbConnect from '@/lib/dbConnect'
import { Category } from '@/lib/models/Category'
import { Article } from '@/lib/models/Article'
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
      return NextResponse.json({ success: false, message: 'Ungültige Kategorie-ID' }, { status: 400 })
    }
    const category = await Category.findById(id).lean()
    if (!category) {
      return NextResponse.json({ success: false, message: 'Kategorie nicht gefunden' }, { status: 404 })
    }
    return NextResponse.json({ success: true, data: category })
  } catch (error) {
    console.error('Fehler beim Laden der Kategorie:', error)
    return NextResponse.json(
      { success: false, message: 'Fehler beim Laden der Kategorie' },
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
    if (process.env.NODE_ENV === 'production' && csrf !== 'lager:category:update') {
      return NextResponse.json({ success: false, message: 'Ungültige Anforderung' }, { status: 400 })
    }
    const auth = await requireAuth(request, ['admin', 'superadmin'])
    if (!auth.ok) return NextResponse.json({ success: false, message: auth.error }, { status: auth.status })

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, message: 'Ungültige Kategorie-ID' }, { status: 400 })
    }

    const schema = z.object({
      name: z.string().min(1).optional(),
      parentId: z.string().optional().nullable(),
      beschreibung: z.string().optional().or(z.literal(''))
    }).passthrough()

    const parseResult = schema.safeParse(await request.json())
    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, message: 'Validierungsfehler', issues: parseResult.error.flatten() },
        { status: 400 }
      )
    }
    const category = await Category.findByIdAndUpdate(id, parseResult.data, { new: true, runValidators: true })
    if (!category) {
      return NextResponse.json({ success: false, message: 'Kategorie nicht gefunden' }, { status: 404 })
    }
    return NextResponse.json({ success: true, data: category })
  } catch (error) {
    console.error('Fehler beim Aktualisieren der Kategorie:', error)
    return NextResponse.json(
      { success: false, message: 'Fehler beim Aktualisieren der Kategorie' },
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
    if (process.env.NODE_ENV === 'production' && csrf !== 'lager:category:delete') {
      return NextResponse.json({ success: false, message: 'Ungültige Anforderung' }, { status: 400 })
    }
    const auth = await requireAuth(request, ['admin', 'superadmin'])
    if (!auth.ok) return NextResponse.json({ success: false, message: auth.error }, { status: auth.status })

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, message: 'Ungültige Kategorie-ID' }, { status: 400 })
    }

    const category = await Category.findById(id)
    if (!category) {
      return NextResponse.json({ success: false, message: 'Kategorie nicht gefunden' }, { status: 404 })
    }
    const inUse = await Article.findOne({ kategorie: category.name }).lean()
    if (inUse) {
      return NextResponse.json(
        { success: false, message: 'Kategorie wird noch von Artikeln verwendet' },
        { status: 400 }
      )
    }
    await Category.findByIdAndDelete(id)
    return NextResponse.json({ success: true, message: 'Kategorie gelöscht' })
  } catch (error) {
    console.error('Fehler beim Löschen der Kategorie:', error)
    return NextResponse.json(
      { success: false, message: 'Fehler beim Löschen der Kategorie' },
      { status: 500 }
    )
  }
}
