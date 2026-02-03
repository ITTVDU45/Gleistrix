import { NextRequest, NextResponse } from 'next/server'
import dbConnect from '@/lib/dbConnect'
import { Article } from '@/lib/models/Article'
import { requireAuth } from '@/lib/security/requireAuth'
import { createBarcodeLabelsPDF, type LabelArticle } from '@/lib/pdfBarcodeLabels'
import mongoose from 'mongoose'
import { z } from 'zod'

export async function POST(request: NextRequest) {
  try {
    await dbConnect()
    const auth = await requireAuth(request, ['user', 'admin', 'superadmin'])
    if (!auth.ok) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status })
    }
    const schema = z.object({
      artikelIds: z.array(z.string().min(1)).min(1).max(100)
    })
    const parseResult = schema.safeParse(await request.json())
    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, message: 'Validierungsfehler', issues: parseResult.error.flatten() },
        { status: 400 }
      )
    }
    const { artikelIds } = parseResult.data
    const validIds = artikelIds.filter((id) => mongoose.Types.ObjectId.isValid(id))
    if (validIds.length === 0) {
      return NextResponse.json({ success: false, message: 'Keine gültigen Artikel-IDs' }, { status: 400 })
    }
    const articles = await Article.find({ _id: { $in: validIds } }).lean()
    const labels: LabelArticle[] = articles.map((a: unknown) => {
      const d = a as { artikelnummer?: string; bezeichnung?: string; barcode?: string }
      return {
        artikelnummer: d.artikelnummer ?? '',
        bezeichnung: d.bezeichnung ?? '',
        barcode: d.barcode ?? d.artikelnummer ?? ''
      }
    })
    const buffer = await createBarcodeLabelsPDF(labels)
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="Etiketten.pdf"'
      }
    })
  } catch (error) {
    console.error('Fehler beim Erstellen der Etiketten-PDF:', error)
    return NextResponse.json(
      { success: false, message: 'Fehler beim Erstellen des PDF' },
      { status: 500 }
    )
  }
}
