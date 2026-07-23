import { describe, expect, test } from 'vitest'
import {
  budgetUtilization,
  calculateAmountsFromGross,
  calculateAmountsFromNet,
  calculateEmployeeCost,
  entryAffectsBasis,
  eurosToCents,
  nextRecurringDate,
  parseGermanMoneyToCents,
  plannedProjectRevenueCents,
  recurringPeriodKey,
  resolveProjectRevenueCents,
  selectEffectiveEmployeeRate,
  selectEmployeeRateForFunktion,
} from './calculations'

describe('Finanzberechnungen', () => {
  test('rundet Euro zuverlässig auf ganze Cent', () => {
    expect(eurosToCents(10.005)).toBe(1001)
    expect(parseGermanMoneyToCents('1.234,56 €')).toBe(123456)
  })

  test('berechnet Netto, USt. und Brutto in beide Richtungen', () => {
    expect(calculateAmountsFromNet(10_000, 19)).toEqual({ netCents: 10_000, vatCents: 1_900, grossCents: 11_900 })
    expect(calculateAmountsFromGross(11_900, 19)).toEqual({ netCents: 10_000, vatCents: 1_900, grossCents: 11_900 })
  })

  test('wählt den letzten wirksamen Lohnsatz vor dem Leistungsdatum', () => {
    const rates = [
      { validFrom: '2025-01-01', baseHourlyCents: 2000, travelHourlyCents: 1000, nightSurchargePercent: 20, sundaySurchargePercent: 50, holidaySurchargePercent: 100 },
      { validFrom: '2026-01-01', baseHourlyCents: 2500, travelHourlyCents: 1500, nightSurchargePercent: 25, sundaySurchargePercent: 50, holidaySurchargePercent: 100 },
    ]
    expect(selectEffectiveEmployeeRate(rates, '2025-12-31')?.baseHourlyCents).toBe(2000)
    expect(selectEffectiveEmployeeRate(rates, '2026-02-01')?.baseHourlyCents).toBe(2500)
    expect(selectEffectiveEmployeeRate(rates, '2024-12-31')).toBeUndefined()
  })

  test('wählt den Lohnsatz strikt je Funktion, ohne funktionsübergreifenden Fallback', () => {
    const rates = [
      { funktion: 'SIPO', validFrom: '2026-01-01', baseHourlyCents: 3000, travelHourlyCents: 0, nightSurchargePercent: 25, sundaySurchargePercent: 50, holidaySurchargePercent: 100 },
      { funktion: 'Monteur/bediener', validFrom: '2026-01-01', baseHourlyCents: 2000, travelHourlyCents: 0, nightSurchargePercent: 25, sundaySurchargePercent: 50, holidaySurchargePercent: 100 },
      { funktion: 'SIPO', validFrom: '2026-06-01', baseHourlyCents: 3200, travelHourlyCents: 0, nightSurchargePercent: 25, sundaySurchargePercent: 50, holidaySurchargePercent: 100 },
    ]
    // passende Funktion, jüngster wirksamer Satz vor dem Datum
    expect(selectEmployeeRateForFunktion(rates, 'SIPO', '2026-07-01')?.baseHourlyCents).toBe(3200)
    expect(selectEmployeeRateForFunktion(rates, 'SIPO', '2026-03-01')?.baseHourlyCents).toBe(3000)
    // Funktion wird case-insensitiv/getrimmt verglichen
    expect(selectEmployeeRateForFunktion(rates, ' sipo ', '2026-07-01')?.baseHourlyCents).toBe(3200)
    expect(selectEmployeeRateForFunktion(rates, 'Monteur/bediener', '2026-07-01')?.baseHourlyCents).toBe(2000)
    // ohne passenden Funktionssatz kein Fallback
    expect(selectEmployeeRateForFunktion(rates, 'HFE', '2026-07-01')).toBeUndefined()
    expect(selectEmployeeRateForFunktion(rates, 'SIPO', '2025-12-31')).toBeUndefined()
  })

  test('Referenzfall ergibt 227,50 Euro ohne Cash-Wirkung', () => {
    const cost = calculateEmployeeCost(
      { workHours: 8, travelHours: 1, nightHours: 2, sundayHours: 0, holidayHours: 0 },
      { validFrom: '2026-01-01', baseHourlyCents: 2500, travelHourlyCents: 1500, nightSurchargePercent: 25, sundaySurchargePercent: 50, holidaySurchargePercent: 100 }
    )
    expect(cost).toBe(22_750)
    const entry = { ledgerEffect: 'performance' as const, paymentStatus: 'not_applicable' as const }
    expect(entryAffectsBasis(entry, 'performance')).toBe(true)
    expect(entryAffectsBasis(entry, 'cash')).toBe(false)
  })

  test('addiert überschneidende Zuschläge', () => {
    const cost = calculateEmployeeCost(
      { workHours: 1, travelHours: 0, nightHours: 1, sundayHours: 1, holidayHours: 1 },
      { validFrom: '2026-01-01', baseHourlyCents: 2000, travelHourlyCents: 0, nightSurchargePercent: 25, sundaySurchargePercent: 50, holidaySurchargePercent: 100 }
    )
    expect(cost).toBe(5500)
  })

  test('nutzt Positionssummen vor dem Fallback der Leistungsanfrage', () => {
    expect(plannedProjectRevenueCents({ leistungen: [{ positionen: [{ gesamtsumme: '100,00 €' }, { gesamtsumme: '50,00 €' }] }], leistungsanfrage: { summe: '999,00 €' } })).toBe(15_000)
    expect(plannedProjectRevenueCents({ leistungen: [], leistungsanfrage: { summe: '999,00 €' } })).toBe(99_900)
  })

  test('bevorzugt die LV-Nettosumme vor den Projektleistungen', () => {
    const project = {
      leistungen: [{ positionen: [{ gesamtsumme: '100,00 €' }] }],
      leistungsanfrage: { summe: '999,00 €' },
    }
    // Ausschreibung (Euro) gewinnt
    expect(resolveProjectRevenueCents(project, 2_500)).toBe(250_000)
    // ohne/ungültige LV-Summe greift die bisherige Reihenfolge
    expect(resolveProjectRevenueCents(project, null)).toBe(10_000)
    expect(resolveProjectRevenueCents(project, 0)).toBe(10_000)
    expect(resolveProjectRevenueCents(project, Number.NaN)).toBe(10_000)
    expect(resolveProjectRevenueCents({ leistungsanfrage: { summe: '999,00 €' } }, undefined)).toBe(99_900)
  })

  test('berechnet Budgetauslastung und wiederkehrende Perioden deterministisch', () => {
    expect(budgetUtilization(100_000, 82_500)).toBe(82.5)
    expect(recurringPeriodKey('2026-05-15', 'quarterly')).toBe('2026-Q2')
    expect(nextRecurringDate('2026-05-15T00:00:00.000Z', 'monthly').toISOString().slice(0, 10)).toBe('2026-06-15')
  })
})
