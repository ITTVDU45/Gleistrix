import { describe, expect, test } from 'vitest'
import {
  computeLineItem,
  computeInvoiceTotals,
  computeDueDate,
  findDuplicateAssignments,
  round2,
  suggestInvoiceNumber,
} from './invoiceTotals'

describe('round2', () => {
  test('rundet kaufmännisch auf 2 Nachkommastellen', () => {
    expect(round2(1.005)).toBe(1.01)
    expect(round2(10.994)).toBe(10.99)
    expect(round2(NaN)).toBe(0)
  })
})

describe('computeLineItem', () => {
  test('berechnet Netto, Steuer und Brutto serverseitig', () => {
    // Arrange
    const input = {
      type: 'HOURS' as const,
      description: 'SIPO Einsatz',
      quantity: 8,
      unit: 'h' as const,
      unitPrice: 45.5,
      vatRate: 19,
    }

    // Act
    const li = computeLineItem(input, 'li-1')

    // Assert
    expect(li.netAmount).toBe(364)
    expect(li.vatAmount).toBe(69.16)
    expect(li.grossAmount).toBe(433.16)
  })

  test('ignoriert manipulierte Client-Summen und ungültige Steuersätze', () => {
    const li = computeLineItem(
      {
        type: 'HOURS',
        description: 'Manipuliert',
        quantity: 1,
        unit: 'h',
        unitPrice: 100,
        vatRate: 250,
        // @ts-expect-error – Client könnte Summen mitsenden, sie werden verworfen
        netAmount: 1,
        vatAmount: 0,
        grossAmount: 1,
      },
      'li-2'
    )
    expect(li.vatRate).toBe(19)
    expect(li.netAmount).toBe(100)
    expect(li.grossAmount).toBe(119)
  })
})

describe('computeInvoiceTotals', () => {
  test('summiert Positionen korrekt', () => {
    const items = [
      computeLineItem({ type: 'HOURS', description: 'A', quantity: 2, unit: 'h', unitPrice: 50, vatRate: 19 }, 'a'),
      computeLineItem({ type: 'SURCHARGE', description: 'B', quantity: 1, unit: 'pauschal', unitPrice: 25.55, vatRate: 19 }, 'b'),
      computeLineItem({ type: 'TRAVEL', description: 'C', quantity: 100, unit: 'km', unitPrice: 0.3, vatRate: 7 }, 'c'),
    ]
    const totals = computeInvoiceTotals(items)
    expect(totals.subtotalNet).toBe(155.55)
    expect(totals.totalVat).toBe(round2(19 + 4.85 + 2.1))
    expect(totals.totalGross).toBe(round2(totals.subtotalNet + totals.totalVat))
  })

  test('leere Rechnung ergibt 0', () => {
    expect(computeInvoiceTotals([])).toEqual({ subtotalNet: 0, totalVat: 0, totalGross: 0 })
  })
})

describe('computeDueDate', () => {
  test('addiert Zahlungsziel auf Rechnungsdatum', () => {
    const due = computeDueDate(new Date('2026-07-01T00:00:00Z'), 14)
    expect(due?.toISOString().slice(0, 10)).toBe('2026-07-15')
  })
  test('ohne Zahlungsziel kein Fälligkeitsdatum', () => {
    expect(computeDueDate(new Date(), 0)).toBeUndefined()
  })
})

describe('findDuplicateAssignments', () => {
  const li = (key?: string) => ({ assignmentKey: key })

  test('erkennt Duplikate innerhalb einer Rechnung', () => {
    const result = findDuplicateAssignments([li('p1::k1'), li('p1::k1'), li('p1::k2')], [])
    expect(result.duplicatesInInvoice).toEqual(['p1::k1'])
  })

  test('erkennt bereits in anderen Rechnungen abgerechnete Einsätze', () => {
    const result = findDuplicateAssignments(
      [li('p1::k1')],
      [
        { status: 'SUBMITTED', invoiceNumber: 'RE-1', lineItems: [{ assignmentKey: 'p1::k1' }] },
        { status: 'CANCELLED', invoiceNumber: 'RE-2', lineItems: [{ assignmentKey: 'p1::k1' }] },
      ]
    )
    expect(result.alreadyInvoiced).toEqual([{ assignmentKey: 'p1::k1', invoiceNumber: 'RE-1' }])
  })

  test('stornierte und abgelehnte Rechnungen blockieren nicht', () => {
    const result = findDuplicateAssignments(
      [li('p1::k1')],
      [
        { status: 'CANCELLED', invoiceNumber: 'RE-2', lineItems: [{ assignmentKey: 'p1::k1' }] },
        { status: 'REJECTED', invoiceNumber: 'RE-3', lineItems: [{ assignmentKey: 'p1::k1' }] },
      ]
    )
    expect(result.alreadyInvoiced).toEqual([])
  })
})

describe('suggestInvoiceNumber', () => {
  test('baut Präfix-Jahr-Sequenz', () => {
    expect(suggestInvoiceNumber('ABC', 2026, 7)).toBe('ABC-2026-0007')
  })
  test('fällt ohne Präfix auf RE zurück und säubert Sonderzeichen', () => {
    expect(suggestInvoiceNumber(undefined, 2026, 1)).toBe('RE-2026-0001')
    expect(suggestInvoiceNumber('Mü/ller GmbH!', 2026, 12)).toBe('MllerGmbH-2026-0012')
  })
})
