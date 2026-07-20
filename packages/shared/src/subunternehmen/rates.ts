import { round2 } from '@/lib/subunternehmen/invoiceTotals'
import type { SubcompanyFunctionRate, SubcompanySurchargeRates } from '@/types/subunternehmen'

export interface CompanyWithRates {
  functionRates?: SubcompanyFunctionRate[] | null
  surchargeRates?: SubcompanySurchargeRates | null
}

/** Vereinbarter Stundensatz für eine Funktion (Groß-/Kleinschreibung tolerant). */
export function rateForFunktion(company: CompanyWithRates, funktion: string): number | undefined {
  const rates = company.functionRates || []
  const needle = funktion.trim().toLowerCase()
  const match = rates.find((r) => String(r.funktion || '').trim().toLowerCase() === needle)
  const rate = match ? Number(match.hourlyRate) : NaN
  return Number.isFinite(rate) && rate >= 0 ? rate : undefined
}

export type SurchargeKind = 'nacht' | 'sonntag' | 'feiertag'

/** Zuschlagsprozentsatz je Zuschlagsart, falls hinterlegt. */
export function surchargePercent(company: CompanyWithRates, kind: SurchargeKind): number | undefined {
  const rates = company.surchargeRates
  const value =
    kind === 'nacht' ? rates?.nachtProzent : kind === 'sonntag' ? rates?.sonntagProzent : rates?.feiertagProzent
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined
}

/**
 * Einzelpreis einer Zuschlagsposition: Prozentsatz auf den Funktions-Stundensatz.
 * Ohne hinterlegten Prozentsatz wird der volle Stundensatz vorgeschlagen.
 */
export function surchargeUnitPrice(
  company: CompanyWithRates,
  funktion: string,
  kind: SurchargeKind | undefined
): { unitPrice: number; percentage?: number } {
  const base = rateForFunktion(company, funktion)
  if (base === undefined) return { unitPrice: 0 }
  if (!kind) return { unitPrice: base }
  const pct = surchargePercent(company, kind)
  if (pct === undefined) return { unitPrice: base }
  return { unitPrice: round2(base * (pct / 100)), percentage: pct }
}
