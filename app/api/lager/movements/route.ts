import { NextRequest, NextResponse } from 'next/server'
import dbConnect from '@/lib/dbConnect'
import { StockMovement } from '@/lib/models/StockMovement'
import { Article } from '@/lib/models/Article'
import '@/lib/models/User'
import '@/lib/models/Employee'
import { getCurrentUser } from '@/lib/auth/getCurrentUser'
import { requireAuth } from '@/lib/security/requireAuth'
import mongoose from 'mongoose'
import { z } from 'zod'

const bewegungstypEnum = ['eingang', 'ausgang', 'korrektur', 'inventur'] as const

export async function GET(request: NextRequest) {
  try {
    await dbConnect()
    const { searchParams } = new URL(request.url)
    const artikelId = searchParams.get('artikelId') ?? undefined
    const bewegungstyp = searchParams.get('bewegungstyp') ?? undefined
    const datumVon = searchParams.get('datumVon') ?? undefined
    const datumBis = searchParams.get('datumBis') ?? undefined

    const filter: Record<string, unknown> = {}
    if (artikelId && mongoose.Types.ObjectId.isValid(artikelId)) filter.artikelId = new mongoose.Types.ObjectId(artikelId)
    if (bewegungstyp) filter.bewegungstyp = bewegungstyp
    if (datumVon || datumBis) {
      filter.datum = {}
      if (datumVon) (filter.datum as Record<string, Date>).$gte = new Date(datumVon)
      if (datumBis) (filter.datum as Record<string, Date>).$lte = new Date(datumBis)
    }

    const movements = await StockMovement.find(filter)
      .sort({ datum: -1 })
      .limit(500)
      .populate('artikelId', 'bezeichnung artikelnummer')
      .populate('verantwortlich', 'name')
      .populate('empfaenger', 'name')
      .lean()
    return NextResponse.json({ success: true, movements })
  } catch (error) {
    console.error('Fehler beim Laden der Bewegungen:', error)
    return NextResponse.json(
      { success: false, message: 'Fehler beim Laden der Bewegungen' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    await dbConnect()
    const csrf = request.headers.get('x-csrf-intent')
    if (process.env.NODE_ENV === 'production' && csrf !== 'lager:movement:create') {
      return NextResponse.json({ success: false, message: 'Ungültige Anforderung' }, { status: 400 })
    }
    const auth = await requireAuth(request, ['user', 'admin', 'superadmin'])
    if (!auth.ok) return NextResponse.json({ success: false, message: auth.error }, { status: auth.status })

    const schema = z.object({
      artikelId: z.string().min(1),
      bewegungstyp: z.enum(bewegungstypEnum),
      menge: z.number().positive(),
      datum: z.union([z.string(), z.date()]),
      empfaenger: z.string().optional().nullable(),
      lieferscheinId: z.string().optional().nullable(),
      bemerkung: z.string().optional().or(z.literal(''))
    }).passthrough()

    const parseResult = schema.safeParse(await request.json())
    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, message: 'Validierungsfehler', issues: parseResult.error.flatten() },
        { status: 400 }
      )
    }
    const body = parseResult.data
    const artikelId = body.artikelId
    if (!mongoose.Types.ObjectId.isValid(artikelId)) {
      return NextResponse.json({ success: false, message: 'Ungültige Artikel-ID' }, { status: 400 })
    }

    const article = await Article.findById(artikelId)
    if (!article) {
      return NextResponse.json({ success: false, message: 'Artikel nicht gefunden' }, { status: 404 })
    }

    const currentUser = await getCurrentUser(request)
    const datum = typeof body.datum === 'string' ? new Date(body.datum) : body.datum

    const movementPayload: Record<string, unknown> = {
      artikelId: new mongoose.Types.ObjectId(artikelId),
      bewegungstyp: body.bewegungstyp,
      menge: body.menge,
      datum,
      verantwortlich: currentUser?._id ?? undefined,
      bemerkung: body.bemerkung ?? ''
    }
    if (body.empfaenger && mongoose.Types.ObjectId.isValid(body.empfaenger)) {
      movementPayload.empfaenger = new mongoose.Types.ObjectId(body.empfaenger)
    }
    if (body.lieferscheinId && mongoose.Types.ObjectId.isValid(body.lieferscheinId)) {
      movementPayload.lieferscheinId = new mongoose.Types.ObjectId(body.lieferscheinId)
    }

    if (body.bewegungstyp === 'eingang') {
      await Article.findByIdAndUpdate(artikelId, { $inc: { bestand: body.menge } })
    } else if (body.bewegungstyp === 'ausgang') {
      const newBestand = (article.bestand ?? 0) - body.menge
      if (newBestand < 0) {
        return NextResponse.json(
          { success: false, message: 'Bestand reicht nicht aus' },
          { status: 400 }
        )
      }
      await Article.findByIdAndUpdate(artikelId, { $inc: { bestand: -body.menge } })
    } else if (body.bewegungstyp === 'korrektur' || body.bewegungstyp === 'inventur') {
      await Article.findByIdAndUpdate(artikelId, { bestand: body.menge })
    }

    const movement = await StockMovement.create(movementPayload)

    if (currentUser) {
      try {
        const ActivityLogModel = (await import('@/lib/models/ActivityLog')).default
        await ActivityLogModel.create({
          timestamp: new Date(),
          actionType: 'lager_movement_created',
          module: 'lager',
          performedBy: {
            userId: currentUser._id,
            name: currentUser.name ?? '',
            role: currentUser.role ?? 'user'
          },
          details: {
            entityId: movement._id,
            description: `Bewegung: ${body.bewegungstyp} Menge ${body.menge} für Artikel ${article.bezeichnung}`,
            after: { bewegungstyp: body.bewegungstyp, menge: body.menge }
          }
        })
      } catch (logErr) {
        console.error('ActivityLog Fehler:', logErr)
      }
    }

    return NextResponse.json({ success: true, data: movement }, { status: 201 })
  } catch (error) {
    console.error('Fehler beim Erfassen der Bewegung:', error)
    return NextResponse.json(
      { success: false, message: 'Fehler beim Erfassen der Bewegung' },
      { status: 500 }
    )
  }
}
