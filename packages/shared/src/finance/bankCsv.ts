import { createHash } from 'crypto'
import { parseGermanMoneyToCents } from './calculations'

export interface BankCsvRow {
  rowNumber: number
  bookingDate: string
  valueDate?: string
  amountCents: number
  reference: string
  counterparty?: string
  fingerprint: string
}

const normalizeDate = (value: string) => {
  const trimmed = value.trim()
  const german = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(trimmed)
  if (german) return `${german[3]}-${german[2].padStart(2, '0')}-${german[1].padStart(2, '0')}`
  const parsed = new Date(trimmed)
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10)
}

const splitCsvLine = (line: string, delimiter: string) => {
  const values: string[] = []
  let current = ''
  let quoted = false
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"'
        index += 1
      } else quoted = !quoted
    } else if (char === delimiter && !quoted) {
      values.push(current.trim())
      current = ''
    } else current += char
  }
  values.push(current.trim())
  return values
}

const findColumn = (headers: string[], candidates: string[]) => headers.findIndex(header => candidates.some(candidate => header.includes(candidate)))

export function bankRowFingerprint(row: Pick<BankCsvRow, 'bookingDate' | 'amountCents' | 'reference' | 'counterparty'>) {
  return createHash('sha256')
    .update([row.bookingDate, row.amountCents, row.reference.trim().toLowerCase(), row.counterparty?.trim().toLowerCase() || ''].join('|'))
    .digest('hex')
}

export function parseBankCsv(csv: string): BankCsvRow[] {
  const lines = csv.replace(/^\uFEFF/, '').split(/\r?\n/).filter(line => line.trim())
  if (lines.length < 2) return []
  const delimiter = (lines[0].match(/;/g)?.length || 0) >= (lines[0].match(/,/g)?.length || 0) ? ';' : ','
  const headers = splitCsvLine(lines[0], delimiter).map(header => header.toLowerCase().replace(/["\s_-]/g, ''))
  const dateIndex = findColumn(headers, ['buchungstag', 'buchungsdatum', 'datum', 'date'])
  const valueDateIndex = findColumn(headers, ['valuta', 'wertstellung', 'valuedate'])
  const amountIndex = findColumn(headers, ['betrag', 'amount', 'umsatz'])
  const referenceIndex = findColumn(headers, ['verwendungszweck', 'referenz', 'reference', 'text'])
  const partyIndex = findColumn(headers, ['empfänger', 'auftraggeber', 'zahlungspflichtiger', 'name', 'counterparty'])
  if (dateIndex < 0 || amountIndex < 0) throw new Error('CSV benötigt mindestens Datum und Betrag.')

  return lines.slice(1).flatMap((line, index) => {
    const cells = splitCsvLine(line, delimiter).map(cell => cell.replace(/^"|"$/g, '').trim())
    const bookingDate = normalizeDate(cells[dateIndex] || '')
    const amountCents = parseGermanMoneyToCents(cells[amountIndex] || '')
    if (!bookingDate || amountCents === 0) return []
    const row = {
      rowNumber: index + 2,
      bookingDate,
      valueDate: valueDateIndex >= 0 ? normalizeDate(cells[valueDateIndex] || '') || undefined : undefined,
      amountCents,
      reference: referenceIndex >= 0 ? cells[referenceIndex] || 'Bankbuchung' : 'Bankbuchung',
      counterparty: partyIndex >= 0 ? cells[partyIndex] || undefined : undefined,
      fingerprint: '',
    }
    row.fingerprint = bankRowFingerprint(row)
    return [row]
  })
}
