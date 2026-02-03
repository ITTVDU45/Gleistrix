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

export async function POST(request: NextRequest) {
  try {
    await dbConnect()
    const csrf = request.headers.get('x-csrf-intent')
    if (process.env.NODE_ENV === 'production' && csrf !== 'lager:assignments:bulk') {
      return NextResponse.json({ success: false, message: 'Ungültige Anforderung' }, { status: 400 })
    }
    const auth = await requireAuth(request, ['user', 'admin', 'superadmin'])
    if (!auth.ok) return NextResponse.json({ success: false, message: auth.error }, { status: auth.status })

    const schema = z.object({
      personId: z.string().min(1),
      ausgabedatum: z.union([z.string(), z.date()]),
      geplanteRueckgabe: z.union([z.string(), z.date(), z.null()]).optional(),
      bemerkung: z.string().optional().or(z.literal('')),
      createDeliveryNote: z.boolean().optional().default(false),
      positionen: z.array(z.object({
        artikelId: z.string().min(1),
        menge: z.number().min(1)
      })).min(1, 'Mindestens eine Position erforderlich')
    }).passthrough()

    const parseResult = schema.safeParse(await request.json())
    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, message: 'Validierungsfehler', issues: parseResult.error.flatten() },
        { status: 400 }
      )
    }
    const body = parseResult.data
    const personId = body.personId
    if (!mongoose.Types.ObjectId.isValid(personId)) {
      return NextResponse.json({ success: false, message: 'Ungültige Person-ID' }, { status: 400 })
    }

    const currentUser = await getCurrentUser(request)
    const ausgabedatum = typeof body.ausgabedatum === 'string' ? new Date(body.ausgabedatum) : body.ausgabedatum
    const geplanteRueckgabe = body.geplanteRueckgabe
      ? (typeof body.geplanteRueckgabe === 'string' ? new Date(body.geplanteRueckgabe) : body.geplanteRueckgabe)
      : undefined

    const positionen = body.positionen.filter(
      (p) => mongoose.Types.ObjectId.isValid(p.artikelId) && p.menge > 0
    )
    if (positionen.length === 0) {
      return NextResponse.json({ success: false, message: 'Keine gültigen Positionen' }, { status: 400 })
    }

    const articles: { id: mongoose.Types.ObjectId; bezeichnung: string; bestand: number }[] = []
    for (const pos of positionen) {
      const art = await Article.findById(pos.artikelId).lean()
      if (!art) {
        return NextResponse.json({ success: false, message: `Artikel ${pos.artikelId} nicht gefunden` }, { status: 404 })
      }
      const bestand = (art as { bestand?: number }).bestand ?? 0
      if (bestand < pos.menge) {
        return NextResponse.json(
          { success: false, message: `Bestand reicht nicht aus für ${(art as { bezeichnung?: string }).bezeichnung ?? pos.artikelId} (max. ${bestand})` },
          { status: 400 }
        )
      }
      articles.push({
        id: pos.artikelId as unknown as mongoose.Types.ObjectId,
        bezeichnung: (art as { bezeichnung?: string }).bezeichnung ?? 'Artikel',
        bestand
      })
    }

    let deliveryNoteId: mongoose.Types.ObjectId | undefined
    if (body.createDeliveryNote) {
      const employee = await Employee.findById(personId).lean()
      const empfaengerName = (employee as { name?: string } | null)?.name ?? 'Unbekannt'
      const nummer = await getNextDeliveryNoteNumber()
      const deliveryPositionen = positionen.map((p, i) => ({
        artikelId: new mongoose.Types.ObjectId(p.artikelId),
        bezeichnung: articles[i]?.bezeichnung ?? 'Artikel',
        menge: p.menge,
        seriennummer: ''
      }))
      const deliveryNote = await DeliveryNote.create({
        typ: 'ausgang',
        nummer,
        datum: ausgabedatum,
        empfaenger: { name: empfaengerName, adresse: '' },
        positionen: deliveryPositionen,
        verantwortlich: currentUser?._id,
        status: 'abgeschlossen'
      })
      deliveryNoteId = deliveryNote._id as mongoose.Types.ObjectId
    }

    const created: unknown[] = []
    for (let i = 0; i < positionen.length; i++) {
      const pos = positionen[i]
      const artikelId = new mongoose.Types.ObjectId(pos.artikelId)
      const assignment = await ArticleAssignment.create({
        artikelId,
        personId: new mongoose.Types.ObjectId(personId),
        menge: pos.menge,
        ausgabedatum,
        geplanteRueckgabe: geplanteRueckgabe ?? undefined,
        status: 'ausgegeben',
        bemerkung: body.bemerkung ?? '',
        ...(deliveryNoteId && { lieferscheinId: deliveryNoteId })
      })
      await Article.findByIdAndUpdate(pos.artikelId, { $inc: { bestand: -pos.menge } })
      await StockMovement.create({
        artikelId,
        bewegungstyp: 'ausgang',
        menge: pos.menge,
        datum: ausgabedatum,
        verantwortlich: currentUser?._id,
        empfaenger: new mongoose.Types.ObjectId(personId),
        ...(deliveryNoteId && { lieferscheinId: deliveryNoteId }),
        bemerkung: body.bemerkung ? `Sammelausgabe: ${body.bemerkung}` : 'Sammelausgabe an Mitarbeiter'
      })
      const populated = await ArticleAssignment.findById(assignment._id)
        .populate('artikelId', 'bezeichnung artikelnummer')
        .populate('personId', 'name')
        .lean()
      created.push(populated ?? assignment)
    }

    if (currentUser && created.length > 0) {
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
            description: `Sammelausgabe: ${positionen.length} Position(en) an Mitarbeiter`,
            after: { positionen: positionen.length }
          }
        })
      } catch (logErr) {
        console.error('ActivityLog Fehler:', logErr)
      }
    }

    return NextResponse.json({ success: true, data: created }, { status: 201 })
  } catch (error) {
    console.error('Fehler bei der Sammelausgabe:', error)
    return NextResponse.json(
      { success: false, message: 'Fehler bei der Sammelausgabe' },
      { status: 500 }
    )
  }
}
