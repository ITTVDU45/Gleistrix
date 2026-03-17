import { NextRequest, NextResponse } from 'next/server'
import dbConnect from '@/lib/dbConnect'
import { ArticleType } from '@/lib/models/ArticleType'
import { requireAuth } from '@/lib/security/requireAuth'
import { z } from 'zod'

const DEFAULT_TYPES = ['Werkzeug', 'Maschine', 'Akku', 'Komponente', 'Verbrauch', 'Sonstiges']

export async function GET() {
  try {
    await dbConnect()
    const types = await ArticleType.find({}).sort({ name: 1 }).lean()
    const names: string[] = types.map((t) => (t as { name: string }).name)

    for (const def of DEFAULT_TYPES) {
      if (!names.includes(def)) names.push(def)
    }
    names.sort((a, b) => a.localeCompare(b, 'de'))

    return NextResponse.json({ success: true, types: names })
  } catch (error) {
    console.error('Fehler beim Laden der Artikeltypen:', error)
    return NextResponse.json(
      { success: false, message: 'Fehler beim Laden der Artikeltypen' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    await dbConnect()
    const csrf = request.headers.get('x-csrf-intent')
    if (process.env.NODE_ENV === 'production' && csrf !== 'lager:article-type:create') {
      return NextResponse.json({ success: false, message: 'Ungueltige Anforderung' }, { status: 400 })
    }
    const auth = await requireAuth(request, ['lager', 'admin', 'superadmin'])
    if (!auth.ok) return NextResponse.json({ success: false, message: auth.error }, { status: auth.status })

    const schema = z.object({ name: z.string().min(1).max(50) })
    const parseResult = schema.safeParse(await request.json())
    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, message: 'Name ist Pflicht (max. 50 Zeichen)' },
        { status: 400 }
      )
    }

    const name = parseResult.data.name.trim()
    if (!name) {
      return NextResponse.json({ success: false, message: 'Name darf nicht leer sein' }, { status: 400 })
    }

    const existing = await ArticleType.findOne({ name }).lean()
    if (existing || DEFAULT_TYPES.includes(name)) {
      return NextResponse.json({ success: false, message: 'Typ existiert bereits' }, { status: 409 })
    }

    await ArticleType.create({ name })
    return NextResponse.json({ success: true, name }, { status: 201 })
  } catch (error) {
    console.error('Fehler beim Anlegen des Artikeltyps:', error)
    if ((error as { code?: number }).code === 11000) {
      return NextResponse.json({ success: false, message: 'Typ existiert bereits' }, { status: 409 })
    }
    return NextResponse.json(
      { success: false, message: 'Fehler beim Anlegen des Artikeltyps' },
      { status: 500 }
    )
  }
}
