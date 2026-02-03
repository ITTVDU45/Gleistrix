import { NextRequest, NextResponse } from 'next/server'
import dbConnect from '@/lib/dbConnect'
import { ArticleAssignment } from '@/lib/models/ArticleAssignment'
import { Article } from '@/lib/models/Article'
import { StockMovement } from '@/lib/models/StockMovement'
import { DeliveryNote } from '@/lib/models/DeliveryNote'
import { Employee } from '@/lib/models/Employee'
import { getNextDeliveryNoteNumber } from '@/lib/utils/deliveryNoteNumber'
import { getCurrentUser } from '@/lib/auth/getCurrentUser'
import { requireAuth } from '@/lib/security/requireAuth'
import mongoose from 'mongoose'
import { z } from 'zod'

export async function GET(request: NextRequest) {
  try {
    await dbConnect()
    const { searchParams } = new URL(request.url)
    const personId = searchParams.get('personId') ?? undefined
    const artikelId = searchParams.get('artikelId') ?? undefined
    const status = searchParams.get('status') ?? undefined

    const filter: Record<string, unknown> = {}
    if (personId && mongoose.Types.ObjectId.isValid(personId)) filter.personId = new mongoose.Types.ObjectId(personId)
    if (artikelId && mongoose.Types.ObjectId.isValid(artikelId)) filter.artikelId = new mongoose.Types.ObjectId(artikelId)
    if (status) filter.status = status

    const assignments = await ArticleAssignment.find(filter)
      .sort({ ausgabedatum: -1 })
      .limit(500)
      .populate('artikelId', 'bezeichnung artikelnummer barcode')
      .populate('personId', 'name')
      .lean()
    return NextResponse.json({ success: true, assignments })
  } catch (error) {
    console.error('Fehler beim Laden der Zuweisungen:', error)
    return NextResponse.json(
      { success: false, message: 'Fehler beim Laden der Zuweisungen' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    await dbConnect()
    const csrf = request.headers.get('x-csrf-intent')
    if (process.env.NODE_ENV === 'production' && csrf !== 'lager:assignments:create') {
      return NextResponse.json({ success: false, message: 'Ungültige Anforderung' }, { status: 400 })
    }
    const auth = await requireAuth(request, ['user', 'admin', 'superadmin'])
    if (!auth.ok) return NextResponse.json({ success: false, message: auth.error }, { status: auth.status })

    const schema = z.object({
      artikelId: z.string().min(1),
      personId: z.string().min(1),
      menge: z.number().min(1).default(1),
      ausgabedatum: z.union([z.string(), z.date()]),
      geplanteRueckgabe: z.union([z.string(), z.date(), z.null()]).optional(),
      bemerkung: z.string().optional().or(z.literal('')),
      createDeliveryNote: z.boolean().optional().default(false)
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
    const personId = body.personId
    if (!mongoose.Types.ObjectId.isValid(artikelId) || !mongoose.Types.ObjectId.isValid(personId)) {
      return NextResponse.json({ success: false, message: 'Ungültige Artikel- oder Person-ID' }, { status: 400 })
    }

    const article = await Article.findById(artikelId)
    if (!article) {
      return NextResponse.json({ success: false, message: 'Artikel nicht gefunden' }, { status: 404 })
    }
    const currentBestand = article.bestand ?? 0
    if (currentBestand < body.menge) {
      return NextResponse.json(
        { success: false, message: 'Bestand reicht nicht aus' },
        { status: 400 }
      )
    }

    const currentUser = await getCurrentUser(request)
    const ausgabedatum = typeof body.ausgabedatum === 'string' ? new Date(body.ausgabedatum) : body.ausgabedatum
    const geplanteRueckgabe = body.geplanteRueckgabe
      ? (typeof body.geplanteRueckgabe === 'string' ? new Date(body.geplanteRueckgabe) : body.geplanteRueckgabe)
      : undefined

    let deliveryNoteId: mongoose.Types.ObjectId | undefined
    if (body.createDeliveryNote) {
      const employee = await Employee.findById(personId).lean()
      const empfaengerName = (employee as { name?: string } | null)?.name ?? 'Unbekannt'
      const nummer = await getNextDeliveryNoteNumber()
      const bezeichnung = (article as { bezeichnung?: string }).bezeichnung ?? 'Artikel'
      const deliveryNote = await DeliveryNote.create({
        typ: 'ausgang',
        nummer,
        datum: ausgabedatum,
        empfaenger: { name: empfaengerName, adresse: '' },
        positionen: [{
          artikelId: new mongoose.Types.ObjectId(artikelId),
          bezeichnung,
          menge: body.menge,
          seriennummer: ''
        }],
        verantwortlich: currentUser?._id,
        status: 'abgeschlossen'
      })
      deliveryNoteId = deliveryNote._id as mongoose.Types.ObjectId
    }

    const assignment = await ArticleAssignment.create({
      artikelId: new mongoose.Types.ObjectId(artikelId),
      personId: new mongoose.Types.ObjectId(personId),
      menge: body.menge,
      ausgabedatum,
      geplanteRueckgabe: geplanteRueckgabe ?? undefined,
      status: 'ausgegeben',
      bemerkung: body.bemerkung ?? '',
      ...(deliveryNoteId && { lieferscheinId: deliveryNoteId })
    })

    await Article.findByIdAndUpdate(artikelId, { $inc: { bestand: -body.menge } })

    await StockMovement.create({
      artikelId: new mongoose.Types.ObjectId(artikelId),
      bewegungstyp: 'ausgang',
      menge: body.menge,
      datum: ausgabedatum,
      verantwortlich: currentUser?._id,
      empfaenger: new mongoose.Types.ObjectId(personId),
      ...(deliveryNoteId && { lieferscheinId: deliveryNoteId }),
      bemerkung: body.bemerkung ? `Ausgabe: ${body.bemerkung}` : 'Ausgabe an Mitarbeiter'
    })

    if (currentUser) {
      try {
        const ActivityLogModel = (await import('@/lib/models/ActivityLog')).default
        await ActivityLogModel.create({
          timestamp: new Date(),
          actionType: 'lager_assignment_created',
          module: 'lager',
          performedBy: {
            userId: currentUser._id,
            name: currentUser.name ?? '',
            role: currentUser.role ?? 'user'
          },
          details: {
            entityId: assignment._id,
            description: `Ausgabe: ${article.bezeichnung} an Mitarbeiter`,
            after: { menge: body.menge }
          }
        })
      } catch (logErr) {
        console.error('ActivityLog Fehler:', logErr)
      }
    }

    const populated = await ArticleAssignment.findById(assignment._id)
      .populate('artikelId', 'bezeichnung artikelnummer')
      .populate('personId', 'name')
      .lean()
    return NextResponse.json({ success: true, data: populated ?? assignment }, { status: 201 })
  } catch (error) {
    console.error('Fehler beim Anlegen der Ausgabe:', error)
    return NextResponse.json(
      { success: false, message: 'Fehler beim Anlegen der Ausgabe' },
      { status: 500 }
    )
  }
}
