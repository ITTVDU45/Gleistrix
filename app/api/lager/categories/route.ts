import { NextRequest, NextResponse } from 'next/server'
import dbConnect from '@/lib/dbConnect'
import { Category } from '@/lib/models/Category'
import { requireAuth } from '@/lib/security/requireAuth'
import { z } from 'zod'

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
      return NextResponse.json({ success: false, message: 'Ungültige Anforderung' }, { status: 400 })
    }
    const auth = await requireAuth(request, ['admin', 'superadmin'])
    if (!auth.ok) return NextResponse.json({ success: false, message: auth.error }, { status: auth.status })

    const schema = z.object({
      name: z.string().min(1),
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
    const body = parseResult.data
    const category = await Category.create(body)
    return NextResponse.json({ success: true, data: category }, { status: 201 })
  } catch (error) {
    console.error('Fehler beim Anlegen der Kategorie:', error)
    return NextResponse.json(
      { success: false, message: 'Fehler beim Anlegen der Kategorie' },
      { status: 500 }
    )
  }
}
