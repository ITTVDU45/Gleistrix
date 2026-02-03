import { NextRequest, NextResponse } from 'next/server'
import dbConnect from '@/lib/dbConnect'
import { DeliveryNote } from '@/lib/models/DeliveryNote'
import { requireAuth } from '@/lib/security/requireAuth'
import { createDeliveryNotePDF } from '@/lib/pdfExportLager'
import mongoose from 'mongoose'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect()
    const auth = await requireAuth(_request, ['user', 'admin', 'superadmin'])
    if (!auth.ok) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status })
    }
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
    const nummer = (doc as { nummer?: string }).nummer ?? 'Lieferschein'
    const safeFilename = nummer.replace(/[^a-zA-Z0-9-_]/g, '_')
    const buffer = await createDeliveryNotePDF(doc as unknown as Parameters<typeof createDeliveryNotePDF>[0])
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Lieferschein-${safeFilename}.pdf"`
      }
    })
  } catch (error) {
    console.error('Fehler beim Erstellen des Lieferschein-PDF:', error)
    return NextResponse.json(
      { success: false, message: 'Fehler beim Erstellen des PDF' },
      { status: 500 }
    )
  }
}
