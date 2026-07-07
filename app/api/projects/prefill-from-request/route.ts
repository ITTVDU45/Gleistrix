import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/security/requireAuth'
import { fetchPageText, extractFromText } from '@/lib/services/leistungsanfrage'

const schema = z
  .object({
    url: z.string().trim().optional(),
    text: z.string().trim().optional(),
  })
  .refine((d) => Boolean(d.url) || Boolean(d.text), { message: 'url oder text erforderlich' })

/**
 * POST /api/projects/prefill-from-request
 * Extrahiert Projekt-Stammdaten aus einer Leistungsanfrage (URL oder Text) per KI.
 */
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, ['user', 'admin', 'superadmin'])
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
  }

  const parsed = schema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Bitte einen Link oder Text angeben.' }, { status: 400 })
  }

  // Textquelle bestimmen: eingefügter Text hat Vorrang, sonst Seite laden.
  let text = parsed.data.text || ''
  if (!text && parsed.data.url) {
    const page = await fetchPageText(parsed.data.url)
    if (!page.ok || !page.text) {
      return NextResponse.json({ success: false, error: page.reason || 'Seite konnte nicht geladen werden.' }, { status: 422 })
    }
    text = page.text
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
