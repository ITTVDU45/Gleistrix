import { NextRequest, NextResponse } from 'next/server'
import dbConnect from '@/lib/dbConnect'
import { Article } from '@/lib/models/Article'
import ActivityLog from '@/lib/models/ActivityLog'
import { getCurrentUser } from '@/lib/auth/getCurrentUser'
import { requireAuth } from '@/lib/security/requireAuth'
import { z } from 'zod'
import { generateArticleBarcode } from '@/lib/utils/barcode'

const articleTypEnum = ['Werkzeug', 'Maschine', 'Akku', 'Komponente', 'Verbrauch', 'Sonstiges'] as const
const zustandEnum = ['neu', 'gut', 'gebraucht', 'defekt'] as const
const statusEnum = ['aktiv', 'archiviert', 'gesperrt'] as const

export async function GET(request: NextRequest) {
  try {
    await dbConnect()
    const { searchParams } = new URL(request.url)
    const kategorie = searchParams.get('kategorie') ?? undefined
    const typ = searchParams.get('typ') ?? undefined
    const lagerort = searchParams.get('lagerort') ?? undefined
    const status = searchParams.get('status') ?? undefined

    const filter: Record<string, unknown> = {}
    if (kategorie) filter.kategorie = kategorie
    if (typ) filter.typ = typ
    if (lagerort) filter.lagerort = lagerort
    if (status) filter.status = status

    const articles = await Article.find(filter).sort({ bezeichnung: 1 }).lean()
    return NextResponse.json({ success: true, articles })
  } catch (error) {
    console.error('Fehler beim Laden der Artikel:', error)
    return NextResponse.json(
      { success: false, message: 'Fehler beim Laden der Artikel' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    await dbConnect()
    const csrf = request.headers.get('x-csrf-intent')
    if (process.env.NODE_ENV === 'production' && csrf !== 'lager:article:create') {
      return NextResponse.json({ success: false, message: 'Ungültige Anforderung' }, { status: 400 })
    }
    const auth = await requireAuth(request, ['user', 'admin', 'superadmin'])
    if (!auth.ok) return NextResponse.json({ success: false, message: auth.error }, { status: auth.status })

    const schema = z.object({
      artikelnummer: z.string().min(1),
      bezeichnung: z.string().min(1),
      kategorie: z.string().min(1),
      unterkategorie: z.string().optional().or(z.literal('')),
      typ: z.enum(articleTypEnum),
      bestand: z.number().optional().default(0),
      mindestbestand: z.number().optional().default(0),
      lagerort: z.string().optional().or(z.literal('')),
      seriennummer: z.string().optional().or(z.literal('')),
      zustand: z.enum(zustandEnum).optional().default('gut'),
      barcode: z.string().optional(),
      wartungsintervallMonate: z.number().optional().nullable(),
      naechsteWartung: z.union([z.string(), z.date(), z.null()]).optional(),
      status: z.enum(statusEnum).optional().default('aktiv')
    }).passthrough()

    const parseResult = schema.safeParse(await request.json())
    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, message: 'Validierungsfehler', issues: parseResult.error.flatten() },
        { status: 400 }
      )
    }
    const body = parseResult.data as Record<string, unknown>
    if (!body.barcode || body.barcode === '') {
      body.barcode = generateArticleBarcode()
    }
    if (body.naechsteWartung === null || body.naechsteWartung === '') {
      body.naechsteWartung = undefined
    } else if (typeof body.naechsteWartung === 'string') {
      body.naechsteWartung = new Date(body.naechsteWartung)
    }

    const currentUser = await getCurrentUser(request)
    const article = await Article.create(body)

    if (currentUser) {
      try {
        const ActivityLogModel = (await import('@/lib/models/ActivityLog')).default
        await ActivityLogModel.create({
          timestamp: new Date(),
          actionType: 'lager_article_created',
          module: 'lager',
          performedBy: {
            userId: currentUser._id,
            name: currentUser.name ?? '',
            role: currentUser.role ?? 'user'
          },
          details: {
            entityId: article._id,
            description: `Artikel angelegt: ${body.bezeichnung} (${body.artikelnummer})`,
            after: { bezeichnung: body.bezeichnung, artikelnummer: body.artikelnummer }
          }
        })
      } catch (logErr) {
        console.error('ActivityLog Fehler:', logErr)
      }
    }

    return NextResponse.json({ success: true, data: article }, { status: 201 })
  } catch (error) {
    console.error('Fehler beim Anlegen des Artikels:', error)
    return NextResponse.json(
      { success: false, message: 'Fehler beim Anlegen des Artikels' },
      { status: 500 }
    )
  }
}
