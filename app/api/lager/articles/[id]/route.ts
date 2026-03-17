import { NextRequest, NextResponse } from 'next/server'
import dbConnect from '@/lib/dbConnect'
import { Article } from '@/lib/models/Article'
import { getCurrentUser } from '@/lib/auth/getCurrentUser'
import { requireAuth } from '@/lib/security/requireAuth'
import mongoose from 'mongoose'
import { z } from 'zod'

const zustandEnum = ['neu', 'gut', 'gebraucht', 'defekt'] as const
const statusEnum = ['aktiv', 'archiviert', 'gesperrt'] as const

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect()
    const { id } = await params
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, message: 'Ungültige Artikel-ID' }, { status: 400 })
    }
    const article = await Article.findById(id).lean()
    if (!article) {
      return NextResponse.json({ success: false, message: 'Artikel nicht gefunden' }, { status: 404 })
    }
    return NextResponse.json({ success: true, data: article })
  } catch (error) {
    console.error('Fehler beim Laden des Artikels:', error)
    return NextResponse.json(
      { success: false, message: 'Fehler beim Laden des Artikels' },
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
    if (process.env.NODE_ENV === 'production' && csrf !== 'lager:article:update') {
      return NextResponse.json({ success: false, message: 'Ungültige Anforderung' }, { status: 400 })
    }
    const auth = await requireAuth(request, ['lager', 'user', 'admin', 'superadmin'])
    if (!auth.ok) return NextResponse.json({ success: false, message: auth.error }, { status: auth.status })

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, message: 'Ungültige Artikel-ID' }, { status: 400 })
    }

    const schema = z.object({
      artikelnummer: z.string().min(1).optional(),
      bezeichnung: z.string().min(1).optional(),
      kategorie: z.string().min(1).optional(),
      unterkategorie: z.string().optional().or(z.literal('')),
      typ: z.string().min(1).optional(),
      bestand: z.number().optional(),
      mindestbestand: z.number().optional(),
      lagerort: z.string().optional().or(z.literal('')),
      seriennummer: z.string().optional().or(z.literal('')),
      zustand: z.enum(zustandEnum).optional(),
      wartungsintervallMonate: z.number().optional().nullable(),
      naechsteWartung: z.string().datetime().optional().nullable().or(z.literal(null)),
      wartungsstatus: z.enum(['ok', 'faellig', 'ueberfaellig', 'in_wartung']).optional(),
      status: z.enum(statusEnum).optional(),
      serialTracking: z.enum(['none', 'individual']).optional()
    }).passthrough()

    const parseResult = schema.safeParse(await request.json())
    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, message: 'Validierungsfehler', issues: parseResult.error.flatten() },
        { status: 400 }
      )
    }
    const body = { ...parseResult.data } as Record<string, unknown>
    if (body.naechsteWartung === null || body.naechsteWartung === '') {
      body.naechsteWartung = undefined
    } else if (typeof body.naechsteWartung === 'string') {
      body.naechsteWartung = new Date(body.naechsteWartung)
    }

    const currentUser = await getCurrentUser(request)
    const existing = await Article.findById(id)
    if (!existing) {
      return NextResponse.json({ success: false, message: 'Artikel nicht gefunden' }, { status: 404 })
    }

    const article = await Article.findByIdAndUpdate(id, body, { new: true, runValidators: true })
    if (!article) {
      return NextResponse.json({ success: false, message: 'Artikel nicht gefunden' }, { status: 404 })
    }

    if (currentUser) {
      try {
        const ActivityLogModel = (await import('@/lib/models/ActivityLog')).default
        await ActivityLogModel.create({
          timestamp: new Date(),
          actionType: 'lager_article_updated',
          module: 'lager',
          performedBy: {
            userId: currentUser._id,
            name: currentUser.name ?? '',
            role: currentUser.role ?? 'user'
          },
          details: {
            entityId: article._id,
            description: `Artikel bearbeitet: ${article.bezeichnung}`,
            before: { bezeichnung: existing.bezeichnung, status: existing.status },
            after: { bezeichnung: article.bezeichnung, status: article.status }
          }
        })
      } catch (logErr) {
        console.error('ActivityLog Fehler:', logErr)
      }
    }

    return NextResponse.json({ success: true, data: article })
  } catch (error) {
    console.error('Fehler beim Aktualisieren des Artikels:', error)
    return NextResponse.json(
      { success: false, message: 'Fehler beim Aktualisieren des Artikels' },
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
    if (process.env.NODE_ENV === 'production' && csrf !== 'lager:article:delete') {
      return NextResponse.json({ success: false, message: 'Ungültige Anforderung' }, { status: 400 })
    }
    const auth = await requireAuth(request, ['lager', 'user', 'admin', 'superadmin'])
    if (!auth.ok) return NextResponse.json({ success: false, message: auth.error }, { status: auth.status })

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, message: 'Ungültige Artikel-ID' }, { status: 400 })
    }

    const currentUser = await getCurrentUser(request)
    const article = await Article.findById(id)
    if (!article) {
      return NextResponse.json({ success: false, message: 'Artikel nicht gefunden' }, { status: 404 })
    }

    await Article.findByIdAndDelete(id)

    if (currentUser) {
      try {
        const ActivityLogModel = (await import('@/lib/models/ActivityLog')).default
        await ActivityLogModel.create({
          timestamp: new Date(),
          actionType: 'lager_article_deleted',
          module: 'lager',
          performedBy: {
            userId: currentUser._id,
            name: currentUser.name ?? '',
            role: currentUser.role ?? 'user'
          },
          details: {
            entityId: article._id,
            description: `Artikel geloescht: ${article.bezeichnung} (${article.artikelnummer})`,
            before: { bezeichnung: article.bezeichnung, artikelnummer: article.artikelnummer, kategorie: article.kategorie }
          }
        })
      } catch (logErr) {
        console.error('ActivityLog Fehler:', logErr)
      }
    }

    return NextResponse.json({ success: true, message: 'Artikel geloescht' })
  } catch (error) {
    console.error('Fehler beim Loeschen des Artikels:', error)
    return NextResponse.json(
      { success: false, message: 'Fehler beim Loeschen des Artikels' },
      { status: 500 }
    )
  }
}
