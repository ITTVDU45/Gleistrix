import { z } from 'zod'

const objectId = z.string().regex(/^[a-f\d]{24}$/i).optional().or(z.literal(''))
const dateString = z.string().refine(value => !Number.isNaN(new Date(value).getTime()), 'Ungültiges Datum')

export const financeEntrySchema = z.object({
  direction: z.enum(['income', 'expense']),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional(),
  categoryId: objectId,
  recognitionDate: dateString,
  dueDate: dateString.optional().or(z.literal('')),
  paidAt: dateString.optional().or(z.literal('')),
  paymentStatus: z.enum(['open', 'paid', 'cancelled', 'not_applicable']).default('open'),
  ledgerEffect: z.enum(['performance', 'cash', 'both']).default('both'),
  netCents: z.number().int().min(0),
  vatCents: z.number().int().min(0),
  grossCents: z.number().int().min(0),
  vatRate: z.number().min(0).max(100),
  accountId: objectId,
  projectId: objectId,
  employeeId: objectId,
  subcompanyId: objectId,
  receivedInvoiceId: objectId,
  vehicleId: objectId,
  materialId: objectId,
  reference: z.string().trim().max(300).optional(),
  invoiceNumber: z.string().trim().max(100).optional(),
  source: z.enum(['manual', 'ai_receipt', 'adjustment']).default('manual'),
}).superRefine((value, ctx) => {
  if (value.netCents + value.vatCents !== value.grossCents) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['grossCents'], message: 'Netto plus Umsatzsteuer muss Brutto ergeben.' })
  }
  if (value.paymentStatus === 'paid' && !value.paidAt) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['paidAt'], message: 'Für bezahlte Buchungen ist ein Zahlungsdatum erforderlich.' })
  }
  if ((value.ledgerEffect === 'cash' || value.ledgerEffect === 'both') && value.paymentStatus === 'paid' && !value.accountId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['accountId'], message: 'Für bezahlte Cash-Buchungen ist ein Konto erforderlich.' })
  }
})

export const financeAccountSchema = z.object({
  name: z.string().trim().min(1).max(120),
  type: z.enum(['bank', 'cash']).default('bank'),
  iban: z.string().trim().max(40).optional(),
  bankName: z.string().trim().max(120).optional(),
  openingBalanceCents: z.number().int(),
  balanceDate: dateString,
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
})

export const financeCategorySchema = z.object({
  slug: z.string().trim().min(1).max(80).regex(/^[a-z0-9-]+$/),
  name: z.string().trim().min(1).max(100),
  direction: z.enum(['income', 'expense', 'both']).default('expense'),
  color: z.string().regex(/^#[0-9a-f]{6}$/i).default('#64748b'),
  isActive: z.boolean().default(true),
})

export const employeeFinanceRateSchema = z.object({
  employeeId: z.string().regex(/^[a-f\d]{24}$/i),
  validFrom: dateString,
  baseHourlyCents: z.number().int().min(0),
  travelHourlyCents: z.number().int().min(0),
  nightSurchargePercent: z.number().min(0).max(1000),
  sundaySurchargePercent: z.number().min(0).max(1000),
  holidaySurchargePercent: z.number().min(0).max(1000),
  note: z.string().trim().max(500).optional(),
})

export const financeBudgetSchema = z.object({
  name: z.string().trim().min(1).max(120),
  categoryId: objectId,
  projectId: objectId,
  basis: z.enum(['performance', 'cash']).default('performance'),
  period: z.enum(['month', 'quarter', 'year']),
  year: z.number().int().min(2000).max(2200),
  month: z.number().int().min(1).max(12).optional(),
  quarter: z.number().int().min(1).max(4).optional(),
  limitCents: z.number().int().min(0),
  warningPercent: z.number().min(0).max(100).default(80),
  isActive: z.boolean().default(true),
}).superRefine((value, ctx) => {
  if (value.period === 'month' && !value.month) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['month'], message: 'Monat fehlt.' })
  if (value.period === 'quarter' && !value.quarter) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['quarter'], message: 'Quartal fehlt.' })
})

export const financeRecurringSchema = z.object({
  name: z.string().trim().min(1).max(120),
  interval: z.enum(['monthly', 'quarterly', 'yearly']),
  nextDueDate: dateString,
  isActive: z.boolean().default(true),
  entryTemplate: financeEntrySchema,
})

export function financeValidationError(error: z.ZodError) {
  return { error: 'Validierungsfehler', issues: error.issues.map(issue => ({ path: issue.path.join('.'), message: issue.message })) }
}
