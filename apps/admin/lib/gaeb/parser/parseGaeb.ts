import { toArray, getNested, extractText, parseNumber } from '@/lib/gaeb/xml/gaebXmlHelpers'
import type {
  GaebBillOfQuantities,
  GaebLot,
  GaebTitle,
  GaebPosition,
  GaebVersionId,
  GaebExchangePhaseCode,
} from '@/types/gaeb'

/**
 * Best-effort-Parser für GAEB DA XML (3.x) → interne BoQ-Struktur.
 *
 * Reine Funktion, keine IO-/UI-Logik. Robust gegen fehlende Felder: extrahiert
 * verfügbare Daten (OZ, Kurz-/Langtext, Menge, Einheit, Preise) und gruppiert
 * Kategorien in Lose/Titel. GAEB erlaubt beliebige Verschachtelung – tiefere
 * Ebenen werden pragmatisch in Titel zusammengefasst.
 */

function str(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined
  const s = String(value).trim()
  return s.length ? s : undefined
}

function itemToPosition(item: Record<string, unknown>, currency: string): GaebPosition {
  const ordinalNumber =
    str(item['@_RNoPart']) ?? str(getNested(item, 'RNoPart')) ?? str(item['@_ID']) ?? ''

  const description = getNested(item, 'Description')
  const shortFromPath = extractText(
    getNested(description, 'CompleteText', 'OutlineText', 'OutlTxt', 'TextOutlTxt'),
    400
  )
  const longText = extractText(getNested(description, 'CompleteText', 'DetailTxt', 'Text'), 8000)
  const shortText = shortFromPath || extractText(description, 400) || '(ohne Bezeichnung)'

  const unitPrice = parseNumber(getNested(item, 'UP'))
  const totalPrice = parseNumber(getNested(item, 'IT'))

  return {
    ordinalNumber,
    type: 'normal',
    shortText,
    longText: longText || undefined,
    quantity: parseNumber(getNested(item, 'Qty')),
    unit: str(getNested(item, 'QU')),
    price:
      unitPrice !== undefined || totalPrice !== undefined
        ? { unitPrice, totalPrice, currency }
        : undefined,
  }
}

/** Sammelt Items an dieser Body-Ebene (nicht rekursiv in Unterkategorien). */
function collectDirectItems(body: unknown, currency: string): GaebPosition[] {
  const items = toArray<Record<string, unknown>>(getNested(body, 'Itemlist', 'Item'))
  return items.map((it) => itemToPosition(it, currency))
}

/** Sammelt ALLE Items unter einem Knoten (rekursiv über Unterkategorien). */
function collectAllItems(node: unknown, currency: string, depth = 0): GaebPosition[] {
  if (depth > 30) return []
  const body = getNested(node, 'BoQBody')
  const positions = collectDirectItems(body, currency)
  const subCats = toArray<Record<string, unknown>>(getNested(body, 'BoQCtgy'))
  for (const sub of subCats) {
    positions.push(...collectAllItems(sub, currency, depth + 1))
  }
  return positions
}

function categoryLabel(cat: Record<string, unknown>, fallback: string): string {
  return (
    extractText(getNested(cat, 'LblTx'), 300) ||
    str(cat['@_RNoPart']) ||
    str(getNested(cat, 'RNoPart')) ||
    fallback
  )
}

function categoryToTitle(cat: Record<string, unknown>, currency: string, index: number): GaebTitle {
  return {
    label: categoryLabel(cat, `Titel ${index + 1}`),
    ordinalNumber: str(cat['@_RNoPart']),
    positions: collectAllItems(cat, currency),
  }
}

function categoryToLot(cat: Record<string, unknown>, currency: string, index: number): GaebLot {
  const body = getNested(cat, 'BoQBody')
  const subCats = toArray<Record<string, unknown>>(getNested(body, 'BoQCtgy'))
  const titles: GaebTitle[] = []

  const directItems = collectDirectItems(body, currency)
  if (directItems.length > 0) {
    titles.push({ label: 'Positionen', positions: directItems })
  }
  subCats.forEach((sub, i) => titles.push(categoryToTitle(sub, currency, i)))

  return {
    label: categoryLabel(cat, `Los ${index + 1}`),
    titles,
  }
}

export interface ParseGaebInput {
  parsed: unknown
  importJobId: string
  version: GaebVersionId
  phase: GaebExchangePhaseCode
}

export function parseGaeb(input: ParseGaebInput): GaebBillOfQuantities {
  const { parsed, importJobId, version, phase } = input
  const gaeb = getNested(parsed, 'GAEB')
  const boq = getNested(gaeb, 'Award', 'BoQ')
  const boqInfo = getNested(boq, 'BoQInfo')
  const currency = str(getNested(boqInfo, 'Cur')) ?? 'EUR'
  const projectName =
    extractText(getNested(gaeb, 'PrjInfo', 'NamePrj'), 300) || str(getNested(boqInfo, 'Name'))

  const body = getNested(boq, 'BoQBody')
  const topCategories = toArray<Record<string, unknown>>(getNested(body, 'BoQCtgy'))

  let lots: GaebLot[]
  if (topCategories.length > 0) {
    lots = topCategories.map((cat, i) => categoryToLot(cat, currency, i))
  } else {
    lots = [{ label: 'Leistungsverzeichnis', titles: [{ label: 'Positionen', positions: collectDirectItems(body, currency) }] }]
  }

  let positionCount = 0
  let netSum = 0
  let hasSum = false
  for (const lot of lots) {
    for (const title of lot.titles) {
      positionCount += title.positions.length
      for (const pos of title.positions) {
        if (pos.price?.totalPrice !== undefined) {
          netSum += pos.price.totalPrice
          hasSum = true
        }
      }
    }
  }

  return {
    _id: '',
    importJobId,
    version,
    phase,
    projectName,
    currency,
    netSum: hasSum ? Math.round(netSum * 100) / 100 : undefined,
    grossSum: undefined,
    lots,
    positionCount,
    createdAt: new Date().toISOString(),
  }
}
