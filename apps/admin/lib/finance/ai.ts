import { z } from 'zod'
import { calculateAmountsFromGross } from '@/lib/finance-core/calculations'
import { extractTextFromPdf } from '@/lib/services/leistungsanfrage'

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'
const DEFAULT_MODEL = 'gpt-4o'

const receiptDraftSchema = z.object({
  direction: z.enum(['income', 'expense']).default('expense'),
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  invoiceNumber: z.string().max(100).optional(),
  recognitionDate: z.string(),
  dueDate: z.string().optional(),
  paymentStatus: z.enum(['open', 'paid']).default('open'),
  netCents: z.number().int().min(0).optional(),
  vatCents: z.number().int().min(0).optional(),
  grossCents: z.number().int().min(0),
  vatRate: z.number().min(0).max(100).default(19),
  categoryHint: z.string().max(100).optional(),
  reference: z.string().max(300).optional(),
})

async function openAiJson(messages: unknown[], maxTokens = 1200) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return { configured: false as const, reason: 'KI nicht konfiguriert (OPENAI_API_KEY fehlt).' }
  const model = process.env.OPENAI_MODEL || DEFAULT_MODEL
  const response = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, temperature: 0, response_format: { type: 'json_object' }, max_tokens: maxTokens, messages }),
  })
  if (!response.ok) throw new Error(`OpenAI-Fehler (${response.status}): ${(await response.text().catch(() => '')).slice(0, 240)}`)
  const result = await response.json() as { choices?: Array<{ message?: { content?: string } }> }
  const raw = result.choices?.[0]?.message?.content || '{}'
  return { configured: true as const, model, data: JSON.parse(raw) as Record<string, unknown> }
}

export async function extractFinanceReceipt(file: File) {
  if (!['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Erlaubt sind PDF, JPEG, PNG und WebP.')
  if (file.size > 10 * 1024 * 1024) throw new Error('Die Datei darf höchstens 10 MB groß sein.')
  const bytes = new Uint8Array(await file.arrayBuffer())
  const system = [
    'Du extrahierst Buchungsdaten aus deutschen Belegen für ein Finanzcockpit.',
    'Gib ausschließlich ein JSON-Objekt zurück. Geldbeträge sind ganzzahlige Euro-Cent-Werte.',
    'Felder: direction, title, description, invoiceNumber, recognitionDate (YYYY-MM-DD), dueDate, paymentStatus, netCents, vatCents, grossCents, vatRate, categoryHint, reference.',
    'Nichts erfinden. Unklare optionale Werte weglassen. Der Nutzer prüft den Entwurf vor dem Speichern.',
  ].join(' ')
  let userContent: unknown
  if (file.type === 'application/pdf') {
    const text = await extractTextFromPdf(bytes)
    userContent = `Dateiname: ${file.name}\n\n${text.slice(0, 16000)}`
  } else {
    const dataUrl = `data:${file.type};base64,${Buffer.from(bytes).toString('base64')}`
    userContent = [
      { type: 'text', text: `Extrahiere den Beleg ${file.name}.` },
      { type: 'image_url', image_url: { url: dataUrl, detail: 'high' } },
    ]
  }
  const response = await openAiJson([{ role: 'system', content: system }, { role: 'user', content: userContent }])
  if (!response.configured) return response
  const parsed = receiptDraftSchema.parse(response.data)
  const computed = parsed.netCents === undefined || parsed.vatCents === undefined
    ? calculateAmountsFromGross(parsed.grossCents, parsed.vatRate)
    : { netCents: parsed.netCents, vatCents: parsed.vatCents, grossCents: parsed.grossCents }
  return {
    configured: true as const,
    model: response.model,
    draft: {
      ...parsed,
      ...computed,
      recognitionDate: parsed.recognitionDate || new Date().toISOString().slice(0, 10),
      ledgerEffect: parsed.paymentStatus === 'paid' ? 'both' : 'performance',
      source: 'ai_receipt',
    },
  }
}

export async function generateFinanceReport(snapshot: Record<string, unknown>) {
  const response = await openAiJson([
    {
      role: 'system',
      content: 'Du bist Finanzcontroller für einen deutschen Bahndienstleister. Analysiere ausschließlich die aggregierten Daten. Antworte als JSON mit title und content. content ist prägnantes Markdown mit Lage, Auffälligkeiten, Budgetrisiken und drei priorisierten Maßnahmen. Keine Rechts- oder Steuerberatung.',
    },
    { role: 'user', content: JSON.stringify(snapshot) },
  ], 1800)
  if (!response.configured) return response
  const parsed = z.object({ title: z.string().min(1).max(180), content: z.string().min(1) }).parse(response.data)
  return { configured: true as const, model: response.model, ...parsed }
}
