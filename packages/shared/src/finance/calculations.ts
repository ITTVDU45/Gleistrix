import type {
  EmployeeCostInput,
  EmployeeRateInput,
  FinanceBudgetBasis,
  FinanceEntryDto,
} from '@/types/finance'

export const roundCents = (value: number) => Math.round(Number.isFinite(value) ? value : 0)

export const eurosToCents = (value: number) => roundCents(value * 100)

export const centsToEuros = (value: number) => roundCents(value) / 100

export function parseGermanMoneyToCents(value: unknown): number {
  if (typeof value === 'number') return eurosToCents(value)
  if (typeof value !== 'string') return 0
  const normalized = value
    .replace(/\s/g, '')
    .replace(/€/g, '')
    .replace(/\.(?=\d{3}(?:\D|$))/g, '')
    .replace(',', '.')
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? eurosToCents(parsed) : 0
}

export function calculateAmountsFromNet(netCents: number, vatRate: number) {
  const safeNet = Math.max(0, roundCents(netCents))
  const safeRate = Math.max(0, Number(vatRate) || 0)
  const vatCents = roundCents(safeNet * safeRate / 100)
  return { netCents: safeNet, vatCents, grossCents: safeNet + vatCents }
}

export function calculateAmountsFromGross(grossCents: number, vatRate: number) {
  const safeGross = Math.max(0, roundCents(grossCents))
  const safeRate = Math.max(0, Number(vatRate) || 0)
  const netCents = safeRate === 0 ? safeGross : roundCents(safeGross / (1 + safeRate / 100))
  return { netCents, vatCents: safeGross - netCents, grossCents: safeGross }
}

export function selectEffectiveEmployeeRate<T extends EmployeeRateInput>(rates: T[], at: string | Date): T | undefined {
  const target = new Date(at).getTime()
  return [...rates]
    .filter(rate => new Date(rate.validFrom).getTime() <= target)
    .sort((a, b) => new Date(b.validFrom).getTime() - new Date(a.validFrom).getTime())[0]
}

export function normalizeFunktion(value: unknown): string {
  return String(value ?? '').trim().toLocaleLowerCase('de')
}

/**
 * Wählt den wirksamen Lohnsatz strikt für die gegebene Funktion und das Datum.
 * Es gibt keinen funktionsübergreifenden Fallback: passt keine Funktion, ist der Satz undefined.
 */
export function selectEmployeeRateForFunktion<T extends EmployeeRateInput>(rates: T[], funktion: unknown, at: string | Date): T | undefined {
  const key = normalizeFunktion(funktion)
  return selectEffectiveEmployeeRate(rates.filter(rate => normalizeFunktion(rate.funktion) === key), at)
}

export function calculateEmployeeCost(input: EmployeeCostInput, rate: EmployeeRateInput): number {
  const hours = (value: number) => Math.max(0, Number(value) || 0)
  const base = hours(input.workHours) * rate.baseHourlyCents
  const travel = hours(input.travelHours) * rate.travelHourlyCents
  const night = hours(input.nightHours) * rate.baseHourlyCents * rate.nightSurchargePercent / 100
  const sunday = hours(input.sundayHours) * rate.baseHourlyCents * rate.sundaySurchargePercent / 100
  const holiday = hours(input.holidayHours) * rate.baseHourlyCents * rate.holidaySurchargePercent / 100
  return roundCents(base + travel + night + sunday + holiday)
}

export function plannedProjectRevenueCents(project: {
  leistungen?: Array<{ positionen?: Array<{ gesamtsumme?: unknown }> }>
  leistungsanfrage?: { summe?: unknown }
}): number {
  const positions = (project.leistungen || []).flatMap(phase => phase.positionen || [])
  const positionTotal = positions.reduce((sum, position) => sum + parseGermanMoneyToCents(position.gesamtsumme), 0)
  return positionTotal > 0 ? positionTotal : parseGermanMoneyToCents(project.leistungsanfrage?.summe)
}

export interface ProjectRevenueSources {
  leistungen?: Array<{ positionen?: Array<{ gesamtsumme?: unknown }> }>
  leistungsanfrage?: { summe?: unknown }
}

/**
 * Projektumsatz in Cent. Das hochgeladene Leistungsverzeichnis (Ausschreibung) hat Vorrang,
 * danach die Positionssummen der Projektleistungen, zuletzt die Summe der Leistungsanfrage.
 * `tenderNetSum` wird in Euro erwartet (GAEB-Nettosumme).
 */
export function resolveProjectRevenueCents(project: ProjectRevenueSources, tenderNetSum?: number | null): number {
  if (typeof tenderNetSum === 'number' && Number.isFinite(tenderNetSum) && tenderNetSum > 0) {
    return eurosToCents(tenderNetSum)
  }
  return plannedProjectRevenueCents(project)
}

export function entryAffectsBasis(entry: Pick<FinanceEntryDto, 'ledgerEffect' | 'paymentStatus'>, basis: FinanceBudgetBasis) {
  if (entry.paymentStatus === 'cancelled') return false
  if (basis === 'performance') return entry.ledgerEffect === 'performance' || entry.ledgerEffect === 'both'
  return (entry.ledgerEffect === 'cash' || entry.ledgerEffect === 'both') && entry.paymentStatus === 'paid'
}

export function budgetUtilization(limitCents: number, spentCents: number) {
  const safeLimit = Math.max(0, roundCents(limitCents))
  const safeSpent = Math.max(0, roundCents(spentCents))
  return safeLimit === 0 ? (safeSpent > 0 ? 100 : 0) : Math.round(safeSpent / safeLimit * 1000) / 10
}

export function recurringPeriodKey(date: string | Date, interval: 'monthly' | 'quarterly' | 'yearly') {
  const value = new Date(date)
  const year = value.getUTCFullYear()
  const month = value.getUTCMonth() + 1
  if (interval === 'yearly') return `${year}`
  if (interval === 'quarterly') return `${year}-Q${Math.ceil(month / 3)}`
  return `${year}-${String(month).padStart(2, '0')}`
}

export function nextRecurringDate(date: string | Date, interval: 'monthly' | 'quarterly' | 'yearly') {
  const result = new Date(date)
  const months = interval === 'monthly' ? 1 : interval === 'quarterly' ? 3 : 12
  result.setUTCMonth(result.getUTCMonth() + months)
  return result
}
