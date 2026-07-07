/**
 * Extrahiert Projekt-Stammdaten aus einer Leistungsanfrage (z.B. DB
 * Lieferantenportal) per KI, um das Projekt-Anlageformular vorzubefüllen.
 *
 * Zwei Eingänge: entweder eine URL (serverseitig geladen) oder direkt der
 * eingefügte Seitentext (Fallback, falls die Seite Login-geschützt ist).
 */

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'
const DEFAULT_OPENAI_MODEL = 'gpt-4o'
const MAX_TEXT_CHARS = 16000

export interface LeistungsanfrageResult {
  configured: boolean
  /** Auf das Projektformular abbildbare Felder. */
  data?: {
    name?: string
    auftraggeber?: string
    baustelle?: string
    auftragsnummer?: string
    sapNummer?: string
    telefonnummer?: string
    datumBeginn?: string
    datumEnde?: string
  }
  /** Zusatzinfos, die nicht ins Formular passen (zur Anzeige). */
  extra?: { summe?: string; aufgaben?: string; ansprechpartner?: string }
  reason?: string
}

/** Sichtbaren Text einer Seite laden (HTML grob zu Text reduziert). */
export async function fetchPageText(url: string): Promise<{ ok: boolean; text?: string; reason?: string }> {
  let parsed: URL
  try {
    parsed = new URL(url)
    if (!/^https?:$/.test(parsed.protocol)) return { ok: false, reason: 'Nur http(s)-Links werden unterstützt.' }
  } catch {
    return { ok: false, reason: 'Ungültiger Link.' }
  }

  try {
    const res = await fetch(parsed.toString(), {
      headers: {
        'user-agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
        accept: 'text/html,application/xhtml+xml',
        'accept-language': 'de-DE,de;q=0.9',
      },
      redirect: 'follow',
    })
    if (!res.ok) return { ok: false, reason: `Seite nicht erreichbar (HTTP ${res.status}).` }

    const html = await res.text()
    // Sichtbarer Text + in der Seite eingebettete JSON-Daten (SPA-State), da
    // Portale die Inhalte oft nicht als sichtbaren HTML-Text ausliefern.
    const visible = htmlToText(html)
    const embedded = extractEmbeddedJson(html)
    const combined = [visible, embedded].filter(Boolean).join('\n').trim()

    if (combined.length < 200) {
      return {
        ok: false,
        reason:
          'Die Seite liefert kaum Text – vermutlich ist ein Login nötig oder die Inhalte werden erst im Browser geladen. Bitte den Seitentext kopieren und unten einfügen.',
      }
    }
    return { ok: true, text: combined.slice(0, MAX_TEXT_CHARS) }
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : 'Laden fehlgeschlagen.' }
  }
}

/** In der Seite eingebettete JSON-Daten (SPA-State) grob extrahieren. */
function extractEmbeddedJson(html: string): string {
  const chunks: string[] = []
  // <script type="application/json">…</script> und id="__NEXT_DATA__"
  const scriptRe = /<script[^>]*(?:type=["']application\/json["']|id=["']__NEXT_DATA__["'])[^>]*>([\s\S]*?)<\/script>/gi
  let m: RegExpExecArray | null
  while ((m = scriptRe.exec(html)) !== null) {
    const body = (m[1] || '').trim()
    if (body.length > 20) chunks.push(body)
  }
  // Inline-State-Zuweisungen (window.__…__ = {…};)
  const stateRe = /(?:window\.__[A-Z_]+__|__INITIAL_STATE__|__APP_STATE__)\s*=\s*(\{[\s\S]*?\})\s*;?\s*<\/script>/gi
  while ((m = stateRe.exec(html)) !== null) {
    const body = (m[1] || '').trim()
    if (body.length > 20) chunks.push(body)
  }
  // Auf sinnvolle Länge begrenzen
  return chunks.join('\n').slice(0, MAX_TEXT_CHARS)
}

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

const SYSTEM_PROMPT = [
  'Du extrahierst Projekt-Stammdaten aus einer Leistungsanfrage (z.B. Deutsche Bahn Lieferantenportal).',
  'Gib ausschließlich gültiges JSON zurück mit genau diesen Feldern (fehlende Werte = leerer String):',
  'name (Projekt-/Maßnahmenbezeichnung), auftraggeber (bestellende Firma/Stelle), baustelle (Leistungsort/Adresse),',
  'auftragsnummer (Anfrage-/Bestell-/Ausschreibungsnummer), sapNummer, telefonnummer (Kontakt-Telefon),',
  'ansprechpartner (Name der Kontaktperson), datumBeginn (Leistungsbeginn als YYYY-MM-DD), datumEnde (Leistungsende als YYYY-MM-DD),',
  'summe (Auftragswert/Budget inkl. Währung als Text), aufgaben (Kurzbeschreibung der zu erledigenden Leistungen).',
  'Datumsangaben immer als YYYY-MM-DD normalisieren. Nichts erfinden – nur was im Text steht.',
].join(' ')

/** Extrahiert die Felder aus Freitext (Seiteninhalt) via OpenAI. */
export async function extractFromText(text: string): Promise<LeistungsanfrageResult> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return { configured: false, reason: 'KI nicht konfiguriert (OPENAI_API_KEY fehlt).' }
  }

  const res = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL,
      temperature: 0,
      response_format: { type: 'json_object' },
      max_tokens: 800,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: text.slice(0, MAX_TEXT_CHARS) },
      ],
    }),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`OpenAI-Fehler (${res.status}): ${detail.slice(0, 200)}`)
  }

  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
  const raw = json.choices?.[0]?.message?.content || '{}'
  let parsed: Record<string, string> = {}
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('KI-Antwort konnte nicht gelesen werden.')
  }

  const s = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
  return {
    configured: true,
    data: {
      name: s(parsed.name),
      auftraggeber: s(parsed.auftraggeber),
      baustelle: s(parsed.baustelle),
      auftragsnummer: s(parsed.auftragsnummer),
      sapNummer: s(parsed.sapNummer),
      telefonnummer: s(parsed.telefonnummer) || s(parsed.ansprechpartner),
      datumBeginn: s(parsed.datumBeginn),
      datumEnde: s(parsed.datumEnde),
    },
    extra: {
      summe: s(parsed.summe),
      aufgaben: s(parsed.aufgaben),
      ansprechpartner: s(parsed.ansprechpartner),
    },
  }
}
