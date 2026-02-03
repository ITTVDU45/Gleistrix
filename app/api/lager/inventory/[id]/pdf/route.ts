import { NextRequest, NextResponse } from 'next/server'
import dbConnect from '@/lib/dbConnect'
import { Inventory } from '@/lib/models/Inventory'
import { requireAuth } from '@/lib/security/requireAuth'
import { createInventoryProtocolPDF } from '@/lib/pdfExportLager'
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
    const doc = await Inventory.findById(id)
      .populate('positionen.artikelId', 'bezeichnung artikelnummer')
      .lean()
    if (!doc) {
      return NextResponse.json({ success: false, message: 'Inventur nicht gefunden' }, { status: 404 })
    }
    const status = (doc as { status?: string }).status
    if (status !== 'abgeschlossen') {
      return NextResponse.json(
        { success: false, message: 'Inventurprotokoll nur für abgeschlossene Inventur verfügbar' },
        { status: 400 }
      )
    }
    const stichtag = (doc as { stichtag?: Date }).stichtag
    const stichtagStr = stichtag ? new Date(stichtag).toISOString().slice(0, 10) : 'Inventur'
    const safeFilename = stichtagStr.replace(/-/g, '')
    const buffer = await createInventoryProtocolPDF(doc as unknown as Parameters<typeof createInventoryProtocolPDF>[0])
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Inventurprotokoll-${safeFilename}.pdf"`
      }
    })
  } catch (error) {
    console.error('Fehler beim Erstellen des Inventurprotokoll-PDF:', error)
    return NextResponse.json(
      { success: false, message: 'Fehler beim Erstellen des PDF' },
      { status: 500 }
    )
  }
}
