import { NextRequest, NextResponse } from 'next/server'
import dbConnect from '@/lib/dbConnect'
import { Category } from '@/lib/models/Category'
import { requireAuth } from '@/lib/security/requireAuth'
import { z } from 'zod'
import mongoose from 'mongoose'

export async function GET() {
  try {
    await dbConnect()
    const categories = await Category.find({}).sort({ name: 1 }).lean()
    return NextResponse.json({ success: true, categories })
  } catch (error) {
    console.error('Fehler beim Laden der Kategorien:', error)
    return NextResponse.json(
      { success: false, message: 'Fehler beim Laden der Kategorien' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    await dbConnect()
    const csrf = request.headers.get('x-csrf-intent')
    if (process.env.NODE_ENV === 'production' && csrf !== 'lager:category:create') {
      return NextResponse.json({ success: false, message: 'Ungueltige Anforderung' }, { status: 400 })
    }
    const auth = await requireAuth(request, ['lager', 'admin', 'superadmin'])
    if (!auth.ok) return NextResponse.json({ success: false, message: auth.error }, { status: auth.status })

    const schema = z.object({
      name: z.string().min(1),
      parentId: z.string().optional().nullable(),
      beschreibung: z.string().optional().or(z.literal('')),
      typ: z.string().optional()
    }).passthrough()

    const parseResult = schema.safeParse(await request.json())
    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, message: 'Validierungsfehler', issues: parseResult.error.flatten() },
        { status: 400 }
      )
    }

    const body = parseResult.data
    const name = body.name.trim()
    const parentId = body.parentId ? body.parentId.trim() : null

    if (!name) {
      return NextResponse.json({ success: false, message: 'Name ist Pflicht' }, { status: 400 })
    }

    if (parentId && !mongoose.Types.ObjectId.isValid(parentId)) {
      return NextResponse.json({ success: false, message: 'Ungueltige Oberkategorie' }, { status: 400 })
    }

    if (parentId) {
      const parentExists = await Category.exists({ _id: parentId })
      if (!parentExists) {
        return NextResponse.json({ success: false, message: 'Oberkategorie nicht gefunden' }, { status: 400 })
      }
    }

    const existing = await Category.findOne({ name }).lean()
    if (existing) {
      return NextResponse.json({ success: false, message: 'Kategorie existiert bereits' }, { status: 409 })
    }

    const category = await Category.create({
      name,
      parentId: parentId || null,
      beschreibung: body.beschreibung?.trim?.() || '',
      typ: body.typ?.trim?.() || ''
    })

    return NextResponse.json({ success: true, data: category }, { status: 201 })
  } catch (error) {
    console.error('Fehler beim Anlegen der Kategorie:', error)
    if ((error as { code?: number }).code === 11000) {
      return NextResponse.json({ success: false, message: 'Kategorie existiert bereits' }, { status: 409 })
    }
    return NextResponse.json(
      { success: false, message: 'Fehler beim Anlegen der Kategorie' },
      { status: 500 }
    )
  }
}
