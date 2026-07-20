import type { GaebBillOfQuantities, GaebPosition, GaebAgentAnalysis } from '@/types/gaeb'

/**
 * LLM-Anbindung für „Fragen an den Agenten".
 *
 * Baut aus dem geparsten LV (deterministisch) + der regelbasierten Analyse
 * einen kompakten, geerdeten Kontext und beantwortet eine Freitext-Frage über
 * die OpenAI Chat Completions API (per fetch, ohne zusätzliche Dependency).
 *
 * Deploy-sicher: Ohne `OPENAI_API_KEY` wird die Frage nicht abgelehnt,
 * sondern ein klarer Hinweis zurückgegeben (`configured: false`).
 * Das Modell ist über `OPENAI_MODEL` überschreibbar (Default: gpt-4o).
 */

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'
const DEFAULT_OPENAI_MODEL = 'gpt-4o'
const MAX_POSITIONS_IN_CONTEXT = 120
const SHORT_TEXT_MAX = 140

export interface GaebAskResult {
  configured: boolean
  answer: string
}

const SYSTEM_PROMPT = [
  'Du bist ein Kalkulations- und Ausschreibungs-Assistent für ein Gleisbau-/Gerüstbau-Unternehmen.',
  'Beantworte Fragen ausschließlich auf Basis des bereitgestellten Leistungsverzeichnisses (LV) und der Analyse.',
  'Antworte präzise, auf Deutsch, und stütze dich nur auf die gelieferten Daten.',
  'Wenn eine Information nicht im LV enthalten ist, sage das ausdrücklich, statt zu raten.',
  'Halte dich kurz und konkret; nutze bei Aufzählungen knappe Stichpunkte.',
].join(' ')

function truncate(text: string, max: number): string {
  const t = (text ?? '').replace(/\s+/g, ' ').trim()
  return t.length > max ? `${t.slice(0, max)}…` : t
}

function flattenPositions(boq: GaebBillOfQuantities): GaebPosition[] {
  return boq.lots.flatMap((lot) => lot.titles.flatMap((t) => t.positions))
}

/** Kompakter, geerdeter LV-Kontext für das Modell (deterministisch). */
function buildContext(boq: GaebBillOfQuantities, analysis: GaebAgentAnalysis): string {
  const positions = flattenPositions(boq)
  const lines: string[] = []

  lines.push('# Leistungsverzeichnis (Stammdaten)')
  lines.push(`Projektname: ${boq.projectName || '—'}`)
  lines.push(`Version/Phase: ${boq.version || '—'} / ${boq.phase || '—'}`)
  lines.push(`Lose: ${boq.lots.length} · Positionen gesamt: ${boq.positionCount}`)
  if (boq.netSum !== undefined && boq.netSum !== null) {
    lines.push(`Nettosumme: ${boq.netSum} ${boq.currency || 'EUR'}`)
  }
  if (boq.grossSum !== undefined && boq.grossSum !== null) {
    lines.push(`Bruttosumme: ${boq.grossSum} ${boq.currency || 'EUR'}`)
  }

  lines.push('')
  lines.push('# Regelbasierte Analyse')
  lines.push(`Zusammenfassung: ${analysis.summary}`)
  if (analysis.risks.length) {
    lines.push('Risiken:')
    for (const r of analysis.risks) lines.push(`- [${r.level}] ${r.title}: ${r.hint}`)
  }
  if (analysis.missingData.length) {
    lines.push(`Fehlende Angaben: ${analysis.missingData.join('; ')}`)
  }
  if (analysis.clusters.length) {
    lines.push(`Gewerke-Cluster: ${analysis.clusters.map((c) => `${c.label} (${c.positionCount})`).join(', ')}`)
  }

  lines.push('')
  lines.push(`# Positionen (max. ${MAX_POSITIONS_IN_CONTEXT} von ${positions.length})`)
  for (const p of positions.slice(0, MAX_POSITIONS_IN_CONTEXT)) {
    const qty = p.quantity !== undefined ? `${p.quantity} ${p.unit ?? ''}`.trim() : 'o. Menge'
    const unitPrice = p.price?.unitPrice !== undefined ? `EP ${p.price.unitPrice}` : ''
    const totalPrice = p.price?.totalPrice !== undefined ? `GP ${p.price.totalPrice}` : ''
    const price = [unitPrice, totalPrice].filter(Boolean).join(' ') || 'o. Preis'
    lines.push(`- ${p.ordinalNumber ? `${p.ordinalNumber} ` : ''}${truncate(p.shortText, SHORT_TEXT_MAX)} | ${qty} | ${price}`)
  }
  if (positions.length > MAX_POSITIONS_IN_CONTEXT) {
    lines.push(`… (${positions.length - MAX_POSITIONS_IN_CONTEXT} weitere Positionen nicht gelistet)`)
  }

  return lines.join('\n')
}

/**
 * Beantwortet eine Freitext-Frage zum LV. Wirft nicht bei fehlender
 * Konfiguration, sondern liefert `configured: false`.
 */
export async function askGaebAgent(
  boq: GaebBillOfQuantities,
  analysis: GaebAgentAnalysis,
  question: string
): Promise<GaebAskResult> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return {
      configured: false,
      answer:
        'Die LLM-Anbindung ist nicht konfiguriert (OPENAI_API_KEY fehlt). ' +
        'Die regelbasierte Analyse oben steht weiterhin zur Verfügung.',
    }
  }

  const context = buildContext(boq, analysis)
  const userContent = `${context}\n\n# Frage\n${question.trim()}`

  const res = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL,
      max_tokens: 1500,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
    }),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`OpenAI-API-Fehler (${res.status}): ${detail.slice(0, 300)}`)
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>
  }

  const answer = (json.choices?.[0]?.message?.content ?? '').trim()

  return { configured: true, answer: answer || 'Keine Antwort erhalten.' }
}
