import { NextRequest, NextResponse } from 'next/server'
import dbConnect from '@/lib/dbConnect'
import { Inventory } from '@/lib/models/Inventory'
import { Article } from '@/lib/models/Article'
import { StockMovement } from '@/lib/models/StockMovement'
import { getCurrentUser } from '@/lib/auth/getCurrentUser'
import { requireAuth } from '@/lib/security/requireAuth'
import mongoose from 'mongoose'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect()
    const { id } = await params
    const csrf = request.headers.get('x-csrf-intent')
    if (process.env.NODE_ENV === 'production' && csrf !== 'lager:inventory:complete') {
      return NextResponse.json({ success: false, message: 'Ungültige Anforderung' }, { status: 400 })
    }
    const auth = await requireAuth(request, ['user', 'admin', 'superadmin'])
    if (!auth.ok) return NextResponse.json({ success: false, message: auth.error }, { status: auth.status })

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, message: 'Ungültige ID' }, { status: 400 })
    }

    const inv = await Inventory.findById(id).lean() as { _id: unknown; status?: string; stichtag?: Date; positionen?: { artikelId: mongoose.Types.ObjectId; istMenge: number; differenz: number }[] } | null
    if (!inv) return NextResponse.json({ success: false, message: 'Inventur nicht gefunden' }, { status: 404 })
    if ((inv as { status?: string }).status === 'abgeschlossen') {
      return NextResponse.json({ success: false, message: 'Inventur bereits abgeschlossen' }, { status: 400 })
    }

    const currentUser = await getCurrentUser(request)
    const now = new Date()
    const positionen = ((inv as { positionen?: { artikelId: mongoose.Types.ObjectId; istMenge: number; differenz: number }[] }).positionen ?? [])

    for (const pos of positionen) {
      const artikelId = pos.artikelId as mongoose.Types.ObjectId
      if (!artikelId) continue
      await Article.findByIdAndUpdate(artikelId, { bestand: pos.istMenge })
      if (pos.differenz !== 0) {
        await StockMovement.create({
          artikelId,
          bewegungstyp: 'inventur',
          menge: pos.istMenge,
          datum: now,
          verantwortlich: currentUser?._id,
          bemerkung: `Inventur abgeschlossen (Differenz: ${pos.differenz})`
        })
      }
    }

    await Inventory.findByIdAndUpdate(id, {
      status: 'abgeschlossen',
      abgeschlossenAm: now,
      abgeschlossenVon: currentUser?._id
    })

    if (currentUser) {
      try {
        const ActivityLogModel = (await import('@/lib/models/ActivityLog')).default
        await ActivityLogModel.create({
          timestamp: now,
          actionType: 'lager_inventory_completed',
          module: 'lager',
          performedBy: {
            userId: currentUser._id,
            name: currentUser.name ?? '',
            role: currentUser.role ?? 'user'
          },
          details: {
            entityId: inv._id,
            description: `Inventur (Stichtag ${new Date((inv as { stichtag?: Date }).stichtag ?? '').toLocaleDateString('de-DE')}) abgeschlossen`,
            after: { status: 'abgeschlossen' }
          }
        })
      } catch (logErr) {
        console.error('ActivityLog Fehler:', logErr)
      }
    }

    const doc = await Inventory.findById(id)
      .populate('positionen.artikelId', 'bezeichnung artikelnummer')
      .lean()
    return NextResponse.json({ success: true, data: doc })
  } catch (error) {
    console.error('Fehler beim Abschließen der Inventur:', error)
    return NextResponse.json(
      { success: false, message: 'Fehler beim Abschließen der Inventur' },
      { status: 500 }
    )
  }
}
