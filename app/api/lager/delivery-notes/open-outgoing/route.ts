import { NextRequest, NextResponse } from 'next/server'
import mongoose from 'mongoose'
import dbConnect from '@/lib/dbConnect'
import { requireAuth } from '@/lib/security/requireAuth'
import { DeliveryNote } from '@/lib/models/DeliveryNote'
import { StockMovement } from '@/lib/models/StockMovement'

export async function GET(request: NextRequest) {
  try {
    await dbConnect()
    const auth = await requireAuth(request, ['lager', 'user', 'admin', 'superadmin'])
    if (!auth.ok) return NextResponse.json({ success: false, message: auth.error }, { status: auth.status })

    const { searchParams } = new URL(request.url)
    const recipient = String(searchParams.get('recipient') ?? '').trim().toLocaleLowerCase('de-DE')

    const outgoingNotes = await DeliveryNote.find({ typ: 'ausgang', status: 'abgeschlossen' })
      .sort({ datum: -1, nummer: -1 })
      .limit(300)
      .select({ _id: 1, nummer: 1, datum: 1, empfaenger: 1, typ: 1 })
      .lean<Array<{
        _id?: unknown
        nummer?: string
        datum?: string | Date
        empfaenger?: { name?: string }
        typ?: string
      }>>()

    const noteIds = outgoingNotes
      .map((note) => String(note._id ?? '').trim())
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id))

    const usedIncoming = noteIds.length > 0
      ? await StockMovement.find({ bewegungstyp: 'eingang', lieferscheinId: { $in: noteIds } })
          .select({ lieferscheinId: 1 })
          .lean<Array<{ lieferscheinId?: unknown }>>()
      : []

    const usedIds = new Set(
      usedIncoming
        .map((row) => String(row.lieferscheinId ?? '').trim())
        .filter(Boolean)
    )

    const openOutgoing = outgoingNotes.filter((note) => {
      const id = String(note._id ?? '').trim()
      if (!id || usedIds.has(id)) return false

      if (!recipient) return true
      const receiverName = String(note.empfaenger?.name ?? '').trim().toLocaleLowerCase('de-DE')
      return receiverName.includes(recipient)
    })

    return NextResponse.json({ success: true, deliveryNotes: openOutgoing })
  } catch (error) {
    console.error('Fehler beim Laden offener Warenausgang-Lieferscheine:', error)
    return NextResponse.json(
      { success: false, message: 'Fehler beim Laden offener Warenausgang-Lieferscheine' },
      { status: 500 }
    )
  }
}
