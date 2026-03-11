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
      return NextResponse.json({ success: false, message: 'Ungueltige Kategorie-ID' }, { status: 400 })
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
      return NextResponse.json({ success: false, message: 'Ungueltige Anforderung' }, { status: 400 })
    }
    const auth = await requireAuth(request, ['lager', 'admin', 'superadmin'])
    if (!auth.ok) return NextResponse.json({ success: false, message: auth.error }, { status: auth.status })

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, message: 'Ungueltige Kategorie-ID' }, { status: 400 })
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

    const updateData: Record<string, unknown> = {}

    if (typeof parseResult.data.name === 'string') {
      const trimmedName = parseResult.data.name.trim()
      if (!trimmedName) {
        return NextResponse.json({ success: false, message: 'Name ist Pflicht' }, { status: 400 })
      }

      const duplicate = await Category.findOne({
        _id: { $ne: id },
        name: trimmedName
      }).lean()
      if (duplicate) {
        return NextResponse.json({ success: false, message: 'Kategorie existiert bereits' }, { status: 409 })
      }
      updateData.name = trimmedName
    }

    if (Object.prototype.hasOwnProperty.call(parseResult.data, 'parentId')) {
      const parentIdRaw = parseResult.data.parentId
      const parentId = typeof parentIdRaw === 'string' ? parentIdRaw.trim() : null

      if (parentId && !mongoose.Types.ObjectId.isValid(parentId)) {
        return NextResponse.json({ success: false, message: 'Ungueltige Oberkategorie' }, { status: 400 })
      }

      if (parentId === id) {
        return NextResponse.json({ success: false, message: 'Kategorie kann nicht ihre eigene Oberkategorie sein' }, { status: 400 })
      }

      if (parentId) {
        const parentExists = await Category.exists({ _id: parentId })
        if (!parentExists) {
          return NextResponse.json({ success: false, message: 'Oberkategorie nicht gefunden' }, { status: 400 })
        }
      }

      updateData.parentId = parentId || null
    }

    if (Object.prototype.hasOwnProperty.call(parseResult.data, 'beschreibung')) {
      updateData.beschreibung = parseResult.data.beschreibung?.trim?.() || ''
    }

    const category = await Category.findByIdAndUpdate(id, updateData, { new: true, runValidators: true })
    if (!category) {
      return NextResponse.json({ success: false, message: 'Kategorie nicht gefunden' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: category })
  } catch (error) {
    console.error('Fehler beim Aktualisieren der Kategorie:', error)
    if ((error as { code?: number }).code === 11000) {
      return NextResponse.json({ success: false, message: 'Kategorie existiert bereits' }, { status: 409 })
    }
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
      return NextResponse.json({ success: false, message: 'Ungueltige Anforderung' }, { status: 400 })
    }
    const auth = await requireAuth(request, ['lager', 'admin', 'superadmin'])
    if (!auth.ok) return NextResponse.json({ success: false, message: auth.error }, { status: auth.status })

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, message: 'Ungueltige Kategorie-ID' }, { status: 400 })
    }

    const category = await Category.findById(id)
    if (!category) {
      return NextResponse.json({ success: false, message: 'Kategorie nicht gefunden' }, { status: 404 })
    }
    const inUse = await Article.findOne({
      $or: [{ kategorie: category.name }, { unterkategorie: category.name }]
    }).lean()
    if (inUse) {
      return NextResponse.json(
        { success: false, message: 'Kategorie wird noch von Artikeln verwendet' },
        { status: 400 }
      )
    }
    const hasChildren = await Category.findOne({ parentId: category._id }).lean()
    if (hasChildren) {
      return NextResponse.json(
        { success: false, message: 'Kategorie hat noch Unterkategorien' },
        { status: 400 }
      )
    }
    await Category.findByIdAndDelete(id)
    return NextResponse.json({ success: true, message: 'Kategorie geloescht' })
  } catch (error) {
    console.error('Fehler beim Loeschen der Kategorie:', error)
    return NextResponse.json(
      { success: false, message: 'Fehler beim Loeschen der Kategorie' },
      { status: 500 }
    )
  }
}
