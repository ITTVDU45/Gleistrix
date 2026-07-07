import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/security/requireAuth'
import { fetchPageText, extractFromText, extractTextFromPdf } from '@/lib/services/leistungsanfrage'

const schema = z
  .object({
    url: z.string().trim().optional(),
    text: z.string().trim().optional(),
  })
  .refine((d) => Boolean(d.url) || Boolean(d.text), { message: 'url oder text erforderlich' })

const MAX_PDF_BYTES = 15 * 1024 * 1024 // 15 MB

/**
 * POST /api/projects/prefill-from-request
 * Extrahiert Projekt-Stammdaten aus einer Leistungsanfrage per KI.
 * Quelle: PDF-Upload (multipart), oder JSON { url } / { text }.
 */
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, ['user', 'admin', 'superadmin'])
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
  }

  let text = ''
  const contentType = req.headers.get('content-type') || ''

  if (contentType.includes('multipart/form-data')) {
    // PDF-Upload
    const form = await req.formData().catch(() => null)
    const file = form?.get('file') as File | null
    if (!file) {
      return NextResponse.json({ success: false, error: 'Keine PDF-Datei erhalten.' }, { status: 400 })
    }
    if (file.type && file.type !== 'application/pdf') {
      return NextResponse.json({ success: false, error: 'Bitte eine PDF-Datei hochladen.' }, { status: 415 })
    }
    if (file.size > MAX_PDF_BYTES) {
      return NextResponse.json({ success: false, error: 'PDF ist zu groß (max. 15 MB).' }, { status: 413 })
    }
    try {
      text = await extractTextFromPdf(new Uint8Array(await file.arrayBuffer()))
    } catch {
      return NextResponse.json({ success: false, error: 'PDF konnte nicht gelesen werden.' }, { status: 422 })
    }
    if (text.trim().length < 30) {
      return NextResponse.json(
        { success: false, error: 'Kaum Text in der PDF (evtl. gescanntes Bild). Bitte den Text einfügen.' },
        { status: 422 }
      )
    }
  } else {
    // JSON: text hat Vorrang, sonst Seite laden
    const parsed = schema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Bitte einen Link, Text oder eine PDF angeben.' }, { status: 400 })
    }
    text = parsed.data.text || ''
    if (!text && parsed.data.url) {
      const page = await fetchPageText(parsed.data.url)
      if (!page.ok || !page.text) {
        return NextResponse.json({ success: false, error: page.reason || 'Seite konnte nicht geladen werden.' }, { status: 422 })
      }
      text = page.text
    }
  }

  if (text.trim().length < 30) {
    return NextResponse.json({ success: false, error: 'Zu wenig Text zum Auswerten.' }, { status: 400 })
  }

  try {
    const result = await extractFromText(text)
    if (!result.configured) {
      return NextResponse.json({ success: false, error: result.reason || 'KI nicht konfiguriert.' }, { status: 503 })
    }
    return NextResponse.json({ success: true, data: result.data, extra: result.extra })
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : 'Auswertung fehlgeschlagen.' },
      { status: 502 }
    )
  }
}
