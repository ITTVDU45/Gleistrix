import { describe, expect, test } from 'vitest'
import { rateForFunktion, surchargePercent, surchargeUnitPrice } from './rates'

const company = {
  functionRates: [
    { funktion: 'SIPO', hourlyRate: 45.5 },
    { funktion: 'Bahnerder', hourlyRate: 52 },
  ],
  surchargeRates: { nachtProzent: 25, sonntagProzent: 50 },
}

describe('rateForFunktion', () => {
  test('findet den Satz zur Funktion (Groß-/Kleinschreibung tolerant)', () => {
    expect(rateForFunktion(company, 'SIPO')).toBe(45.5)
    expect(rateForFunktion(company, 'sipo')).toBe(45.5)
    expect(rateForFunktion(company, ' Bahnerder ')).toBe(52)
  })

  test('liefert undefined ohne hinterlegten Satz', () => {
    expect(rateForFunktion(company, 'HFE')).toBeUndefined()
    expect(rateForFunktion({}, 'SIPO')).toBeUndefined()
    expect(rateForFunktion({ functionRates: null }, 'SIPO')).toBeUndefined()
  })

  test('verwirft ungültige Sätze', () => {
    expect(rateForFunktion({ functionRates: [{ funktion: 'X', hourlyRate: -5 }] }, 'X')).toBeUndefined()
    expect(
      rateForFunktion({ functionRates: [{ funktion: 'X', hourlyRate: Number.NaN }] }, 'X')
    ).toBeUndefined()
  })
})

describe('surchargePercent', () => {
  test('liest hinterlegte Prozentsätze', () => {
    expect(surchargePercent(company, 'nacht')).toBe(25)
    expect(surchargePercent(company, 'sonntag')).toBe(50)
    expect(surchargePercent(company, 'feiertag')).toBeUndefined()
  })
})

describe('surchargeUnitPrice', () => {
  test('berechnet Zuschlagspreis prozentual auf den Stundensatz', () => {
    // 45,50 € × 25 % = 11,38 €
    expect(surchargeUnitPrice(company, 'SIPO', 'nacht')).toEqual({ unitPrice: 11.38, percentage: 25 })
  })

  test('fällt ohne Prozentsatz auf den vollen Stundensatz zurück', () => {
    expect(surchargeUnitPrice(company, 'SIPO', 'feiertag')).toEqual({ unitPrice: 45.5 })
    expect(surchargeUnitPrice(company, 'SIPO', undefined)).toEqual({ unitPrice: 45.5 })
  })

  test('ohne Funktionssatz bleibt der Vorschlag 0 €', () => {
    expect(surchargeUnitPrice(company, 'HFE', 'nacht')).toEqual({ unitPrice: 0 })
  })
})
