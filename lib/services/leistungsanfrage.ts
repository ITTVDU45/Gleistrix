/**
 * Extrahiert Projekt-Stammdaten aus einer Leistungsanfrage (z.B. DB
 * Lieferantenportal) per KI, um das Projekt-Anlageformular vorzubefüllen.
 *
 * Zwei Eingänge: entweder eine URL (serverseitig geladen) oder direkt der
 * eingefügte Seitentext (Fallback, falls die Seite Login-geschützt ist).
 */

import { extractText, getDocumentProxy } from 'unpdf'
import type { LeistungsPhase } from '../../types'

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'
const DEFAULT_OPENAI_MODEL = 'gpt-4o'
const MAX_TEXT_CHARS = 16000

/** Text aus einer hochgeladenen PDF-Leistungsanfrage extrahieren. */
export async function extractTextFromPdf(data: Uint8Array): Promise<string> {
  const pdf = await getDocumentProxy(data)
  const { text } = await extractText(pdf, { mergePages: true })
  const merged = Array.isArray(text) ? text.join('\n') : String(text || '')
  return merged.replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT_CHARS)
}

export interface LeistungsanfrageResult {
  configured: boolean
  /** Auf das Projektformular abbildbare Felder. */
  data?: {
    name?: string
    auftraggeber?: string
    baustelle?: string
    auftragsnummer?: string
    sapNummer?: string
    ansprechpartner?: string
    telefonnummer?: string
    ansprechpartnerEmail?: string
    datumBeginn?: string
    datumEnde?: string
  }
  /** DB-spezifische Zusatzdaten (als eigener Block am Projekt gespeichert). */
  leistungsanfrage?: {
    anfragedatum?: string
    rueckmeldefrist?: string
    leistungszeitraum?: string
    dvaVersicherung?: string
    rvFamilie?: string
    raumlos?: string
    summe?: string
    aufgaben?: string
  }
  /** Strukturierte Leistungen (Phasen mit Positionen). */
  leistungen?: LeistungsPhase[]
  /** Zusatzinfos zur Anzeige direkt nach dem Import. */
  extra?: { summe?: string; aufgaben?: string; ansprechpartner?: string }
  reason?: string
}

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

interface RawPos { nummer?: string; bezeichnung?: string; beschreibung?: string; menge?: string; einheit?: string; einzelpreis?: string; gesamtsumme?: string }
interface RawPhase { subtitel?: string; titel?: string; positionen?: RawPos[] }

function mapLeistungen(raw: unknown): LeistungsPhase[] {
  if (!Array.isArray(raw)) return []
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '')
  return (raw as RawPhase[])
    .map((ph) => ({
      id: uid(),
      subtitel: str(ph?.subtitel),
      titel: str(ph?.titel),
      positionen: Array.isArray(ph?.positionen)
        ? ph.positionen.map((p) => ({
            id: uid(),
            nummer: str(p?.nummer),
            bezeichnung: str(p?.bezeichnung),
            beschreibung: str(p?.beschreibung),
            menge: str(p?.menge),
            einheit: str(p?.einheit),
            einzelpreis: str(p?.einzelpreis),
            gesamtsumme: str(p?.gesamtsumme),
          }))
        : [],
    }))
    .filter((ph) => ph.titel || ph.subtitel || ph.positionen.length > 0)
}

const DB_PORTAL_HOST = 'lieferantenportal.deutschebahn.com'
const GUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i

const JSON_HEADERS = {
  accept: 'application/json, text/plain, */*',
  'accept-language': 'de-DE,de;q=0.9',
  'user-agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
}

/**
 * DB-Lieferantenportal: die Daten liegen hinter einer öffentlichen API (nur der
 * GUID nötig, kein Login). Direkt die Measure- + Contacts-Endpunkte abrufen.
 */
async function fetchDbPortalMeasure(guid: string): Promise<{ ok: boolean; text?: string; reason?: string }> {
  const base = `https://${DB_PORTAL_HOST}/api/external/measures/${guid}`
  try {
    const res = await fetch(base, { headers: JSON_HEADERS, redirect: 'follow' })
    if (!res.ok) {
      return { ok: false, reason: `Leistungsanfrage nicht abrufbar (HTTP ${res.status}). Link evtl. abgelaufen.` }
    }
    const measure = await res.text()

    // Ansprechpartner best-effort ergänzen
    let contacts = ''
    try {
      const cRes = await fetch(`${base}/contacts`, { headers: JSON_HEADERS, redirect: 'follow' })
      if (cRes.ok) contacts = await cRes.text()
    } catch {
      /* optional */
    }

    const combined = [measure, contacts && `\n\nKontakte:\n${contacts}`].filter(Boolean).join('')
    if (combined.trim().length < 30) {
      return { ok: false, reason: 'Leere Antwort vom Portal.' }
    }
    return { ok: true, text: combined.slice(0, MAX_TEXT_CHARS) }
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : 'Abruf fehlgeschlagen.' }
  }
}

/** Sichtbaren Text/Daten einer Seite laden (Portal-API bevorzugt, sonst HTML). */
export async function fetchPageText(url: string): Promise<{ ok: boolean; text?: string; reason?: string }> {
  let parsed: URL
  try {
    parsed = new URL(url)
    if (!/^https?:$/.test(parsed.protocol)) return { ok: false, reason: 'Nur http(s)-Links werden unterstützt.' }
  } catch {
    return { ok: false, reason: 'Ungültiger Link.' }
  }

  // DB-Lieferantenportal direkt über die öffentliche API abrufen
  if (parsed.hostname.endsWith(DB_PORTAL_HOST)) {
    const m = url.match(GUID_RE)
    if (m) return fetchDbPortalMeasure(m[0])
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
  'Du extrahierst Projekt-Stammdaten aus einer Leistungsanfrage des Deutsche Bahn Lieferantenportals.',
  'Die Eingabe kann Freitext oder JSON aus der Portal-API sein – werte beides aus.',
  'Gib ausschließlich gültiges JSON zurück mit genau diesen Feldern (fehlende Werte = leerer String):',
  '- name: die Maßnahmenbezeichnung (Feld "Maßnahme", z.B. "Sicherungsleistung für Ortsbegehung"). NICHT die Maßnahmennummer.',
  '- auftraggeber: die abrufende Stelle/Firma (Feld "Abrufer*in"/"DB InfraGO AG" o.ä.). NIEMALS der Lieferant (das sind wir).',
  '- baustelle: Leistungsort/Örtlichkeit (Strecke, km, Bahnhof/Verkehrsstation aus Beschreibung, sonst "Raumlos").',
  '- auftragsnummer: die Maßnahmennummer, meist mit "A" beginnend (z.B. "A708563").',
  '- sapNummer: die "SAP-RV-Nummer" bzw. SAP-Nummer, rein numerisch (z.B. "92344854").',
  '- ansprechpartner: Name des Ansprechpartners vor Ort (Feld "Ansprechpartner vor Ort").',
  '- telefonnummer: Telefonnummer des Ansprechpartners vor Ort.',
  '- email: E-Mail-Adresse des Ansprechpartners vor Ort.',
  '- datumBeginn / datumEnde: aus "Leistungszeitraum" (Start bzw. Ende), als YYYY-MM-DD.',
  '- summe: "Gesamtsumme vorläufig netto" als deutsch formatierter Euro-Betrag mit Tausenderpunkt, Dezimalkomma und "€" (z.B. "2.025,00 €").',
  '  Falls der Wert als reine Ganzzahl in Cent vorliegt (z.B. 202500), durch 100 teilen und so formatieren (→ "2.025,00 €").',
  '- aufgaben: Kurzliste der Leistungsphasen/Positionen (kommagetrennt).',
  '- anfragedatum: das "Anfragedatum" (wie angezeigt, z.B. "07.07.2026").',
  '- rueckmeldefrist: die "Rückmeldefrist" (wie angezeigt, z.B. "08.07.2026 23:59").',
  '- leistungszeitraum: der "Leistungszeitraum" als Text, IMMER mit Uhrzeiten im Format "DD.MM.YYYY HH:MM - DD.MM.YYYY HH:MM" (z.B. "15.07.2026 10:00 - 15.07.2026 18:00"). Fehlt eine Uhrzeit im Original, verwende für den Beginn "00:00" und für das Ende "23:59".',
  '- dvaVersicherung: "Ja" wenn eine DVA-Versicherung durch den AG vorhanden ist, sonst "Nein" (nur "Ja" oder "Nein").',
  '- rvFamilie: die "RV-Familie" (z.B. "Sicherungsleistungen Konzern (SIPO)").',
  '- raumlos: das "Raumlos" (z.B. "NORD (KIE)").',
  '- leistungen: Array der Leistungen aus dem Abschnitt "Leistungen"/"Leistungsphasen". Jedes Element ist eine Phase',
  '  { "subtitel": <Oberkategorie z.B. "technische Sicherung">, "titel": <z.B. "Feste Absperrung (FA)">,',
  '  "positionen": [ { "nummer": <z.B. "02.01.0010">, "bezeichnung": <Kurztitel>, "beschreibung": <Langtext>,',
  '  "menge": <z.B. "14,00">, "einheit": <"Stück"/"Meter"/"Tage" o.ä.>, "einzelpreis": <z.B. "1.650,00 € / Stück">,',
  '  "gesamtsumme": <z.B. "23.100,00 €"> } ] }. Übernimm alle Positionen, die im Text/JSON vorhanden sind.',
  'Für name/auftraggeber/datum immer normalisieren; für anfragedatum/rueckmeldefrist/leistungszeitraum den Anzeigetext übernehmen.',
  'Beträge (einzelpreis/gesamtsumme/summe) als deutschen Euro-Text mit Tausenderpunkt, Komma und €. Nichts erfinden – nur was in den Daten steht.',
].join('\n')

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
  let parsed: Record<string, unknown> = {}
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('KI-Antwort konnte nicht gelesen werden.')
  }

  const s = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

  const kName = s(parsed.ansprechpartner)
  const kTel = s(parsed.telefonnummer)
  const kMail = s(parsed.email)

  return {
    configured: true,
    data: {
      name: s(parsed.name),
      auftraggeber: s(parsed.auftraggeber),
      baustelle: s(parsed.baustelle),
      auftragsnummer: s(parsed.auftragsnummer),
      sapNummer: s(parsed.sapNummer),
      ansprechpartner: kName,
      // telefonnummer ist Pflichtfeld → notfalls Name eintragen, damit gültig
      telefonnummer: kTel || kName,
      ansprechpartnerEmail: kMail,
      datumBeginn: s(parsed.datumBeginn),
      datumEnde: s(parsed.datumEnde),
    },
    leistungen: mapLeistungen(parsed.leistungen),
    leistungsanfrage: {
      anfragedatum: s(parsed.anfragedatum),
      rueckmeldefrist: s(parsed.rueckmeldefrist),
      leistungszeitraum: s(parsed.leistungszeitraum),
      dvaVersicherung: s(parsed.dvaVersicherung),
      rvFamilie: s(parsed.rvFamilie),
      raumlos: s(parsed.raumlos),
      summe: s(parsed.summe),
      aufgaben: s(parsed.aufgaben),
    },
    extra: {
      summe: s(parsed.summe),
      aufgaben: s(parsed.aufgaben),
      ansprechpartner: [kName, kTel, kMail].filter(Boolean).join(' · '),
    },
  }
}
