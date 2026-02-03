import { NextRequest, NextResponse } from 'next/server'
import dbConnect from '@/lib/dbConnect'
import { Article } from '@/lib/models/Article'
import { requireAuth } from '@/lib/security/requireAuth'
import { createBarcodeLabelsPDF } from '@/lib/pdfBarcodeLabels'
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
      return NextResponse.json({ success: false, message: 'Ungültige Artikel-ID' }, { status: 400 })
    }
    const article = await Article.findById(id).lean()
    if (!article) {
      return NextResponse.json({ success: false, message: 'Artikel nicht gefunden' }, { status: 404 })
    }
    const doc = article as { artikelnummer?: string; bezeichnung?: string; barcode?: string }
    const label = {
      artikelnummer: doc.artikelnummer ?? '',
      bezeichnung: doc.bezeichnung ?? '',
      barcode: doc.barcode ?? doc.artikelnummer ?? ''
    }
    const buffer = await createBarcodeLabelsPDF([label])
    const safeName = (doc.artikelnummer ?? 'Artikel').replace(/[^a-zA-Z0-9-_]/g, '_')
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Etikett-${safeName}.pdf"`
      }
    })
  } catch (error) {
    console.error('Fehler beim Erstellen des Etiketten-PDF:', error)
    return NextResponse.json(
      { success: false, message: 'Fehler beim Erstellen des PDF' },
      { status: 500 }
    )
  }
}
