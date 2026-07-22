export type FinanceDirection = 'income' | 'expense'
export type FinanceLedgerEffect = 'performance' | 'cash' | 'both'
export type FinancePaymentStatus = 'open' | 'paid' | 'cancelled' | 'not_applicable'
export type FinanceBudgetBasis = 'performance' | 'cash'
export type FinanceSource =
  | 'manual'
  | 'ai_receipt'
  | 'recurring'
  | 'bank_csv'
  | 'employee_time'
  | 'subcontractor_estimate'
  | 'subcontractor_invoice'
  | 'adjustment'

export interface FinanceReferenceDto {
  projectId?: string
  projectName?: string
  accountId?: string
  accountName?: string
  categoryId?: string
  categoryName?: string
  employeeId?: string
  employeeName?: string
  subcompanyId?: string
  subcompanyName?: string
  receivedInvoiceId?: string
  vehicleId?: string
  materialId?: string
}

export interface FinanceEntryDto extends FinanceReferenceDto {
  id: string
  direction: FinanceDirection
  title: string
  description?: string
  source: FinanceSource
  sourceKey?: string
  recognitionDate: string
  dueDate?: string
  paidAt?: string
  paymentStatus: FinancePaymentStatus
  ledgerEffect: FinanceLedgerEffect
  netCents: number
  vatCents: number
  grossCents: number
  vatRate: number
  reference?: string
  invoiceNumber?: string
  derived?: boolean
  readOnly?: boolean
  estimated?: boolean
  imported?: boolean
}

export interface FinanceAccountDto {
  id: string
  name: string
  type: 'bank' | 'cash'
  iban?: string
  bankName?: string
  openingBalanceCents: number
  balanceDate: string
  currentBalanceCents: number
  isDefault: boolean
  isActive: boolean
}

export interface FinanceCategoryDto {
  id: string
  slug: string
  name: string
  direction: FinanceDirection | 'both'
  color: string
  isSystem: boolean
  isActive: boolean
}

export interface EmployeeFinanceRateDto {
  id: string
  employeeId: string
  employeeName?: string
  validFrom: string
  baseHourlyCents: number
  travelHourlyCents: number
  nightSurchargePercent: number
  sundaySurchargePercent: number
  holidaySurchargePercent: number
  note?: string
}

export interface FinanceBudgetDto {
  id: string
  name: string
  categoryId?: string
  categoryName?: string
  projectId?: string
  projectName?: string
  basis: FinanceBudgetBasis
  period: 'month' | 'quarter' | 'year'
  year: number
  month?: number
  quarter?: number
  limitCents: number
  spentCents: number
  utilizationPercent: number
  warningPercent: number
  isActive: boolean
}

export interface FinanceRecurringRuleDto {
  id: string
  name: string
  interval: 'monthly' | 'quarterly' | 'yearly'
  nextDueDate: string
  lastBookedPeriod?: string
  isActive: boolean
  entryTemplate: Omit<FinanceEntryDto, 'id' | 'source' | 'sourceKey' | 'derived' | 'readOnly'>
}

export interface FinanceProjectSummaryDto {
  projectId: string
  projectName: string
  plannedRevenueCents: number
  actualRevenueCents: number
  employeeCostCents: number
  subcontractorCostCents: number
  otherCostCents: number
  resultCents: number
  marginPercent: number | null
}

export interface FinanceTimeSeriesPointDto {
  date: string
  incomeCents: number
  expenseCents: number
  netCents: number
  cumulativeCents: number
}

export interface FinanceOverviewDto {
  period: { from: string; to: string }
  filters: { projectId?: string; accountId?: string }
  kpis: {
    liquidityCents: number
    cashInCents: number
    cashOutCents: number
    cashflowCents: number
    actualRevenueCents: number
    employeeCostCents: number
    subcontractorCostCents: number
    otherPerformanceCostCents: number
    projectResultCents: number
  }
  entries: FinanceEntryDto[]
  accounts: FinanceAccountDto[]
  categories: FinanceCategoryDto[]
  budgets: FinanceBudgetDto[]
  recurringRules: FinanceRecurringRuleDto[]
  projects: FinanceProjectSummaryDto[]
  cashSeries: FinanceTimeSeriesPointDto[]
  categoryCosts: Array<{ categoryId?: string; name: string; valueCents: number; color: string }>
  warnings: string[]
}

export interface EmployeeCostInput {
  workHours: number
  travelHours: number
  nightHours: number
  sundayHours: number
  holidayHours: number
}

export interface EmployeeRateInput {
  validFrom: string | Date
  baseHourlyCents: number
  travelHourlyCents: number
  nightSurchargePercent: number
  sundaySurchargePercent: number
  holidaySurchargePercent: number
}
