import { NextRequest, NextResponse } from 'next/server'
import dbConnect from '@/lib/dbConnect'
import { DeliveryNote } from '@/lib/models/DeliveryNote'
import mongoose from 'mongoose'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect()
    const { id } = await params
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, message: 'Ungültige ID' }, { status: 400 })
    }
    const doc = await DeliveryNote.findById(id)
      .populate('positionen.artikelId', 'bezeichnung artikelnummer')
      .lean()
    if (!doc) {
      return NextResponse.json({ success: false, message: 'Lieferschein nicht gefunden' }, { status: 404 })
    }
    return NextResponse.json({ success: true, data: doc })
  } catch (error) {
    console.error('Fehler beim Laden des Lieferscheins:', error)
    return NextResponse.json(
      { success: false, message: 'Fehler beim Laden des Lieferscheins' },
      { status: 500 }
    )
  }
}
