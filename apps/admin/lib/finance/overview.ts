import FinanceAccount from '@/lib/models/FinanceAccount'
import FinanceBudget from '@/lib/models/FinanceBudget'
import FinanceCategory from '@/lib/models/FinanceCategory'
import FinanceEntry from '@/lib/models/FinanceEntry'
import FinanceRecurringRule from '@/lib/models/FinanceRecurringRule'
import EmployeeFinanceRate from '@/lib/models/EmployeeFinanceRate'
import ReceivedInvoice from '@/lib/models/ReceivedInvoice'
import { Employee } from '@/lib/models/Employee'
import { Project } from '@/lib/models/Project'
import { Subcompany } from '@/lib/models/Subcompany'
import { normalizeProjectTimeEntriesToBillingRows, isContinuationEntry } from '@/lib/timeEntry/billingRows'
import { buildAssignmentKey } from '@/lib/subunternehmen/assignments'
import { shouldUseSubcontractorEstimate } from '@/lib/finance-core/subcontractorCosts'
import { rateForFunktion, surchargePercent } from '@/lib/subunternehmen/rates'
import {
  budgetUtilization,
  calculateEmployeeCost,
  entryAffectsBasis,
  eurosToCents,
  plannedProjectRevenueCents,
  selectEffectiveEmployeeRate,
} from '@/lib/finance-core/calculations'
import type {
  FinanceAccountDto,
  FinanceBudgetDto,
  FinanceEntryDto,
  FinanceOverviewDto,
  FinanceProjectSummaryDto,
  FinanceTimeSeriesPointDto,
} from '@/types/finance'
import { ensureDefaultFinanceCategories } from './defaultCategories'
import { serializeFinanceEntry } from './serialize'

interface OverviewFilters {
  from: Date
  to: Date
  projectId?: string
  accountId?: string
}

const asId = (value: unknown) => value ? String(value) : ''
const inDayRange = (day: string, from: Date, to: Date) => day >= from.toISOString().slice(0, 10) && day <= to.toISOString().slice(0, 10)
const asNumber = (value: unknown) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  const parsed = Number(String(value || '').replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : 0
}
const dayIso = (day: string) => new Date(`${day}T12:00:00.000Z`).toISOString()

function budgetBounds(budget: any) {
  if (budget.period === 'month') {
    const from = new Date(Date.UTC(budget.year, budget.month - 1, 1))
    return { from, to: new Date(Date.UTC(budget.year, budget.month, 0, 23, 59, 59, 999)) }
  }
  if (budget.period === 'quarter') {
    const startMonth = (budget.quarter - 1) * 3
    return {
      from: new Date(Date.UTC(budget.year, startMonth, 1)),
      to: new Date(Date.UTC(budget.year, startMonth + 3, 0, 23, 59, 59, 999)),
    }
  }
  return {
    from: new Date(Date.UTC(budget.year, 0, 1)),
    to: new Date(Date.UTC(budget.year, 11, 31, 23, 59, 59, 999)),
  }
}

function createCashSeries(entries: FinanceEntryDto[], from: Date, to: Date): FinanceTimeSeriesPointDto[] {
  const days = Math.max(1, Math.ceil((to.getTime() - from.getTime()) / 86_400_000) + 1)
  const bucket = days > 100 ? 'month' : 'day'
  const values = new Map<string, { incomeCents: number; expenseCents: number }>()
  for (const entry of entries) {
    if (!entryAffectsBasis(entry, 'cash')) continue
    const date = new Date(entry.paidAt || entry.recognitionDate)
    const key = bucket === 'month' ? date.toISOString().slice(0, 7) : date.toISOString().slice(0, 10)
    const current = values.get(key) || { incomeCents: 0, expenseCents: 0 }
    current[entry.direction === 'income' ? 'incomeCents' : 'expenseCents'] += entry.grossCents
    values.set(key, current)
  }
  let cumulativeCents = 0
  return [...values.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, value]) => {
    const netCents = value.incomeCents - value.expenseCents
    cumulativeCents += netCents
    return { date, ...value, netCents, cumulativeCents }
  })
}

export async function getFinanceOverview(filters: OverviewFilters): Promise<FinanceOverviewDto> {
  await ensureDefaultFinanceCategories()

  const entryQuery: Record<string, unknown> = {
    $or: [
      { recognitionDate: { $gte: filters.from, $lte: filters.to } },
      { paidAt: { $gte: filters.from, $lte: filters.to } },
    ],
    ...(filters.projectId ? { projectId: filters.projectId } : {}),
    ...(filters.accountId ? { accountId: filters.accountId } : {}),
  }
  const projectQuery = filters.projectId ? { _id: filters.projectId } : {}
  const invoiceQuery: Record<string, unknown> = {
    status: { $in: ['APPROVED', 'SCHEDULED_FOR_PAYMENT', 'PAID'] },
  }
  if (filters.projectId) invoiceQuery.projectIds = filters.projectId

  const [dbEntries, accounts, categories, projects, employees, rates, invoices, subcompanies, budgets, recurring] = await Promise.all([
    FinanceEntry.find(entryQuery).sort({ recognitionDate: -1, createdAt: -1 }).lean(),
    FinanceAccount.find({}).sort({ isDefault: -1, name: 1 }).lean(),
    FinanceCategory.find({}).sort({ name: 1 }).lean(),
    Project.find(projectQuery).select('name auftragsnummer datumBeginn datumEnde leistungen leistungsanfrage mitarbeiterZeiten').lean(),
    Employee.find({}).select('name miNumber').lean(),
    EmployeeFinanceRate.find({}).sort({ validFrom: -1 }).lean(),
    ReceivedInvoice.find(invoiceQuery).lean(),
    Subcompany.find({}).select('name functionRates surchargeRates').lean(),
    FinanceBudget.find({ isActive: true, ...(filters.projectId ? { projectId: filters.projectId } : {}) }).sort({ year: -1, month: -1 }).lean(),
    FinanceRecurringRule.find({}).sort({ nextDueDate: 1 }).lean(),
  ])

  const budgetRanges = budgets.map(budgetBounds)
  if (budgetRanges.length) {
    const budgetFrom = new Date(Math.min(...budgetRanges.map(range => range.from.getTime())))
    const budgetTo = new Date(Math.max(...budgetRanges.map(range => range.to.getTime())))
    const additionalEntries = await FinanceEntry.find({
      $or: [
        { recognitionDate: { $gte: budgetFrom, $lte: budgetTo } },
        { paidAt: { $gte: budgetFrom, $lte: budgetTo } },
      ],
      ...(filters.projectId ? { projectId: filters.projectId } : {}),
      ...(filters.accountId ? { accountId: filters.accountId } : {}),
    }).lean()
    const knownEntryIds = new Set(dbEntries.map((entry: any) => asId(entry._id)))
    additionalEntries.forEach((entry: any) => {
      if (!knownEntryIds.has(asId(entry._id))) dbEntries.push(entry)
    })
  }

  const categoryMap = new Map(categories.map((value: any) => [asId(value._id), value]))
  const categoryBySlug = new Map(categories.map((value: any) => [value.slug, value]))
  const accountMap = new Map(accounts.map((value: any) => [asId(value._id), value]))
  const projectMap = new Map(projects.map((value: any) => [asId(value._id), value]))
  const employeeMap = new Map(employees.map((value: any) => [asId(value._id), value]))
  const subcompanyMap = new Map(subcompanies.map((value: any) => [asId(value._id), value]))
  const employeesByName = new Map<string, any[]>()
  employees.forEach((employee: any) => {
    const key = String(employee.name || '').trim().toLocaleLowerCase('de')
    employeesByName.set(key, [...(employeesByName.get(key) || []), employee])
  })
  const subcompaniesByName = new Map(subcompanies.map((company: any) => [String(company.name || '').trim().toLocaleLowerCase('de'), company]))
  const ratesByEmployee = new Map<string, any[]>()
  rates.forEach((rate: any) => {
    const key = asId(rate.employeeId)
    ratesByEmployee.set(key, [...(ratesByEmployee.get(key) || []), rate])
  })

  const lookup = { categories: categoryMap, accounts: accountMap, projects: projectMap, employees: employeeMap, subcompanies: subcompanyMap }
  const entries: FinanceEntryDto[] = dbEntries.map((entry: any) => serializeFinanceEntry(entry, lookup) as FinanceEntryDto)
  const warnings: string[] = []

  const approvedAssignmentKeys = new Set<string>()
  invoices.forEach((invoice: any) => invoice.lineItems?.forEach((line: any) => {
    if (line.assignmentKey) approvedAssignmentKeys.add(line.assignmentKey)
  }))

  for (const project of projects as any[]) {
    const projectId = asId(project._id)
    const rows = normalizeProjectTimeEntriesToBillingRows(project.mitarbeiterZeiten || {})
    for (const row of rows) {
      const rowDate = new Date(`${row.day}T12:00:00.000Z`)
      const relevantForBudget = budgetRanges.some(range => rowDate >= range.from && rowDate <= range.to)
      if ((!inDayRange(row.day, filters.from, filters.to) && !relevantForBudget) || isContinuationEntry(row.sourceEntry)) continue
      if (row.isExternal) {
        const assignmentKey = buildAssignmentKey(projectId, row.rowKey)
        if (!shouldUseSubcontractorEstimate(assignmentKey, approvedAssignmentKeys)) continue
        const companyId = asId(row.sourceEntry.externalCompanyId)
        const company = subcompanyMap.get(companyId) || subcompaniesByName.get(String(row.companyName || '').trim().toLocaleLowerCase('de'))
        if (!company) {
          warnings.push(`Subunternehmen für Einsatz ${project.name} am ${row.day} konnte nicht eindeutig zugeordnet werden.`)
          continue
        }
        const hourlyRate = rateForFunktion(company, row.funktion)
        if (hourlyRate === undefined) {
          warnings.push(`Kein Funktionssatz für ${company.name} / ${row.funktion} (${row.day}).`)
          continue
        }
        const baseCents = eurosToCents(hourlyRate)
        const premium = (hours: number, kind: 'nacht' | 'sonntag' | 'feiertag') =>
          hours * baseCents * (surchargePercent(company, kind) || 0) / 100
        const netCents = Math.round(
          (row.stundenTotal + row.fahrtstundenTotal + row.extraTotal) * baseCents
          + premium(row.nachtzulageTotal, 'nacht')
          + premium(row.sonntagsstundenTotal, 'sonntag')
          + premium(row.feiertagTotal, 'feiertag')
        )
        entries.push({
          id: `derived:${assignmentKey}`,
          direction: 'expense',
          title: `${company.name} · ${row.funktion}`,
          description: `${row.count} Einsatzkraft/-kräfte, ${row.stundenTotal.toLocaleString('de-DE')} Std.`,
          source: 'subcontractor_estimate',
          sourceKey: `sub_assignment:${assignmentKey}`,
          recognitionDate: dayIso(row.day),
          paymentStatus: 'not_applicable',
          ledgerEffect: 'performance',
          netCents,
          vatCents: 0,
          grossCents: netCents,
          vatRate: 0,
          projectId,
          projectName: project.name,
          subcompanyId: asId(company._id),
          subcompanyName: company.name,
          categoryId: asId(categoryBySlug.get('subunternehmer')?._id),
          categoryName: categoryBySlug.get('subunternehmer')?.name,
          derived: true,
          readOnly: true,
          estimated: true,
        })
        continue
      }

      const explicitEmployeeId = asId((row.sourceEntry as any).employeeId)
      const matches = explicitEmployeeId ? [employeeMap.get(explicitEmployeeId)].filter(Boolean) : employeesByName.get(String(row.employeeName || '').trim().toLocaleLowerCase('de')) || []
      if (matches.length !== 1) {
        warnings.push(matches.length === 0
          ? `Mitarbeiter „${row.employeeName || 'Unbekannt'}“ (${project.name}, ${row.day}) konnte nicht zugeordnet werden.`
          : `Mitarbeitername „${row.employeeName}“ ist mehrdeutig (${project.name}, ${row.day}).`)
        continue
      }
      const employee = matches[0]
      const rate = selectEffectiveEmployeeRate(ratesByEmployee.get(asId(employee._id)) || [], row.day)
      if (!rate) {
        warnings.push(`Kein gültiger Lohnsatz für ${employee.name} am ${row.day}.`)
        continue
      }
      const netCents = calculateEmployeeCost({
        workHours: row.stundenTotal,
        travelHours: row.fahrtstundenTotal,
        nightHours: row.nachtzulageTotal,
        sundayHours: row.sonntagsstundenTotal,
        holidayHours: row.feiertagTotal,
      }, rate)
      entries.push({
        id: `derived:employee:${projectId}:${row.day}:${row.sourceEntryId}`,
        direction: 'expense',
        title: `${employee.name} · ${row.funktion}`,
        description: `${row.stundenTotal.toLocaleString('de-DE')} Arbeitsstd. · ${row.fahrtstundenTotal.toLocaleString('de-DE')} Fahrtstd.`,
        source: 'employee_time',
        sourceKey: `employee_time:${projectId}:${row.day}:${row.sourceEntryId}`,
        recognitionDate: dayIso(row.day),
        paymentStatus: 'not_applicable',
        ledgerEffect: 'performance',
        netCents,
        vatCents: 0,
        grossCents: netCents,
        vatRate: 0,
        projectId,
        projectName: project.name,
        employeeId: asId(employee._id),
        employeeName: employee.name,
        categoryId: asId(categoryBySlug.get('personalkosten')?._id),
        categoryName: categoryBySlug.get('personalkosten')?.name,
        derived: true,
        readOnly: true,
      })
    }
  }

  for (const invoice of invoices as any[]) {
    const subcompany = subcompanyMap.get(asId(invoice.subcontractorCompanyId))
    const paid = invoice.status === 'PAID'
    let invoiceRelevant = false
    ;(invoice.lineItems || []).forEach((line: any, index: number) => {
      const recognitionDate = line.serviceDate ? new Date(`${line.serviceDate}T12:00:00.000Z`) : new Date(invoice.invoiceDate)
      const paidDate = paid && invoice.paidAt ? new Date(invoice.paidAt) : undefined
      const performanceInRange = recognitionDate >= filters.from && recognitionDate <= filters.to
      const cashInRange = Boolean(paidDate && paidDate >= filters.from && paidDate <= filters.to)
      const budgetInRange = budgetRanges.some(range =>
        (recognitionDate >= range.from && recognitionDate <= range.to)
        || Boolean(paidDate && paidDate >= range.from && paidDate <= range.to)
      )
      if (!performanceInRange && !cashInRange && !budgetInRange) return
      invoiceRelevant = true
      const projectId = asId(line.projectId || invoice.projectIds?.[0])
      if (filters.projectId && projectId !== filters.projectId) return
      const netCents = eurosToCents(asNumber(line.netAmount))
      const vatCents = eurosToCents(asNumber(line.vatAmount))
      const grossCents = eurosToCents(asNumber(line.grossAmount))
      entries.push({
        id: `derived:invoice:${invoice._id}:${line.id || index}`,
        direction: 'expense',
        title: `${subcompany?.name || 'Subunternehmen'} · ${line.description || invoice.invoiceNumber}`,
        source: 'subcontractor_invoice',
        sourceKey: `received_invoice:${invoice._id}:${line.id || index}`,
        recognitionDate: recognitionDate.toISOString(),
        dueDate: invoice.dueDate ? new Date(invoice.dueDate).toISOString() : undefined,
        paidAt: paidDate?.toISOString(),
        paymentStatus: paid ? 'paid' : 'open',
        ledgerEffect: paid ? 'both' : 'performance',
        netCents,
        vatCents,
        grossCents,
        vatRate: asNumber(line.vatRate),
        projectId: projectId || undefined,
        projectName: projectMap.get(projectId)?.name,
        subcompanyId: asId(invoice.subcontractorCompanyId),
        subcompanyName: subcompany?.name,
        receivedInvoiceId: asId(invoice._id),
        invoiceNumber: invoice.invoiceNumber,
        categoryId: asId(categoryBySlug.get('subunternehmer')?._id),
        categoryName: categoryBySlug.get('subunternehmer')?.name,
        derived: true,
        readOnly: true,
      })
    })
    if (invoiceRelevant && paid && !invoice.paidAt) warnings.push(`Rechnung ${invoice.invoiceNumber} ist als bezahlt markiert, hat aber kein Zahlungsdatum.`)
    if (invoiceRelevant && paid) warnings.push(`Bezahlte Rechnung ${invoice.invoiceNumber} ist keinem Finanzkonto zugeordnet; sie beeinflusst keinen Kontosaldo.`)
  }

  const filteredEntries = entries
    .filter(entry => !filters.accountId || entry.accountId === filters.accountId)
    .filter(entry => {
      const recognitionDate = new Date(entry.recognitionDate)
      const paidDate = entry.paidAt ? new Date(entry.paidAt) : undefined
      return (recognitionDate >= filters.from && recognitionDate <= filters.to)
        || Boolean(paidDate && paidDate >= filters.from && paidDate <= filters.to)
    })
    .sort((a, b) => new Date(b.recognitionDate).getTime() - new Date(a.recognitionDate).getTime())
  const performanceEntries = filteredEntries.filter(entry => entryAffectsBasis(entry, 'performance') && new Date(entry.recognitionDate) >= filters.from && new Date(entry.recognitionDate) <= filters.to)
  const cashEntries = filteredEntries.filter(entry => {
    const cashDate = new Date(entry.paidAt || entry.recognitionDate)
    return entryAffectsBasis(entry, 'cash') && cashDate >= filters.from && cashDate <= filters.to
  })
  const sum = (items: FinanceEntryDto[], direction: 'income' | 'expense', field: 'netCents' | 'grossCents') =>
    items.filter(entry => entry.direction === direction).reduce((total, entry) => total + entry[field], 0)
  const actualRevenueCents = sum(performanceEntries, 'income', 'netCents')
  const employeeCostCents = performanceEntries.filter(entry => entry.source === 'employee_time').reduce((total, entry) => total + entry.netCents, 0)
  const subcontractorCostCents = performanceEntries.filter(entry => entry.source === 'subcontractor_estimate' || entry.source === 'subcontractor_invoice').reduce((total, entry) => total + entry.netCents, 0)
  const totalPerformanceCostCents = sum(performanceEntries, 'expense', 'netCents')
  const otherPerformanceCostCents = totalPerformanceCostCents - employeeCostCents - subcontractorCostCents

  const accountCashEntries = await FinanceEntry.find({
    accountId: { $in: accounts.map((account: any) => account._id) },
    paymentStatus: 'paid',
    ledgerEffect: { $in: ['cash', 'both'] },
  }).select('accountId direction grossCents paidAt recognitionDate').lean()
  const accountDtos: FinanceAccountDto[] = accounts.map((account: any) => {
    const movements = accountCashEntries.filter((entry: any) => asId(entry.accountId) === asId(account._id) && new Date(entry.paidAt || entry.recognitionDate) >= new Date(account.balanceDate))
    const movementCents = movements.reduce((total: number, entry: any) => total + (entry.direction === 'income' ? entry.grossCents : -entry.grossCents), 0)
    return {
      id: asId(account._id), name: account.name, type: account.type, iban: account.iban || undefined,
      bankName: account.bankName || undefined, openingBalanceCents: account.openingBalanceCents,
      balanceDate: new Date(account.balanceDate).toISOString(), currentBalanceCents: account.openingBalanceCents + movementCents,
      isDefault: account.isDefault, isActive: account.isActive,
    }
  })

  const projectSummaries: FinanceProjectSummaryDto[] = projects.map((project: any) => {
    const projectId = asId(project._id)
    const projectEntries = performanceEntries.filter(entry => entry.projectId === projectId)
    const revenue = sum(projectEntries, 'income', 'netCents')
    const employee = projectEntries.filter(entry => entry.source === 'employee_time').reduce((total, entry) => total + entry.netCents, 0)
    const subcontractor = projectEntries.filter(entry => ['subcontractor_estimate', 'subcontractor_invoice'].includes(entry.source)).reduce((total, entry) => total + entry.netCents, 0)
    const allCosts = sum(projectEntries, 'expense', 'netCents')
    const result = revenue - allCosts
    return {
      projectId, projectName: project.name, plannedRevenueCents: plannedProjectRevenueCents(project), actualRevenueCents: revenue,
      employeeCostCents: employee, subcontractorCostCents: subcontractor, otherCostCents: allCosts - employee - subcontractor,
      resultCents: result, marginPercent: revenue > 0 ? Math.round(result / revenue * 1000) / 10 : null,
    }
  }).sort((a, b) => b.actualRevenueCents - a.actualRevenueCents)

  const budgetDtos: FinanceBudgetDto[] = budgets.map((budget: any) => {
    const bounds = budgetBounds(budget)
    const relevant = entries.filter(entry => {
      const date = new Date(budget.basis === 'cash' ? entry.paidAt || entry.recognitionDate : entry.recognitionDate)
      return entry.direction === 'expense' && date >= bounds.from && date <= bounds.to
        && (!filters.accountId || entry.accountId === filters.accountId)
        && (!budget.categoryId || entry.categoryId === asId(budget.categoryId))
        && (!budget.projectId || entry.projectId === asId(budget.projectId))
        && entryAffectsBasis(entry, budget.basis)
    })
    const spentCents = relevant.reduce((total, entry) => total + (budget.basis === 'cash' ? entry.grossCents : entry.netCents), 0)
    return {
      id: asId(budget._id), name: budget.name, categoryId: asId(budget.categoryId) || undefined,
      categoryName: categoryMap.get(asId(budget.categoryId))?.name, projectId: asId(budget.projectId) || undefined,
      projectName: projectMap.get(asId(budget.projectId))?.name, basis: budget.basis, period: budget.period,
      year: budget.year, month: budget.month, quarter: budget.quarter, limitCents: budget.limitCents,
      spentCents, utilizationPercent: budgetUtilization(budget.limitCents, spentCents), warningPercent: budget.warningPercent,
      isActive: budget.isActive,
    }
  })

  const categoryCosts = [...performanceEntries.filter(entry => entry.direction === 'expense').reduce((map, entry) => {
    const key = entry.categoryId || 'uncategorized'
    const current = map.get(key) || { categoryId: entry.categoryId, name: entry.categoryName || 'Ohne Kategorie', valueCents: 0, color: categoryMap.get(key)?.color || '#94a3b8' }
    current.valueCents += entry.netCents
    map.set(key, current)
    return map
  }, new Map<string, { categoryId?: string; name: string; valueCents: number; color: string }>()).values()].sort((a, b) => b.valueCents - a.valueCents)

  return {
    period: { from: filters.from.toISOString(), to: filters.to.toISOString() },
    filters: { projectId: filters.projectId, accountId: filters.accountId },
    kpis: {
      liquidityCents: accountDtos.filter(account => account.isActive).reduce((total, account) => total + account.currentBalanceCents, 0),
      cashInCents: sum(cashEntries, 'income', 'grossCents'), cashOutCents: sum(cashEntries, 'expense', 'grossCents'),
      cashflowCents: sum(cashEntries, 'income', 'grossCents') - sum(cashEntries, 'expense', 'grossCents'),
      actualRevenueCents, employeeCostCents, subcontractorCostCents, otherPerformanceCostCents,
      projectResultCents: actualRevenueCents - totalPerformanceCostCents,
    },
    entries: filteredEntries,
    accounts: accountDtos,
    categories: categories.map((category: any) => ({ id: asId(category._id), slug: category.slug, name: category.name, direction: category.direction, color: category.color, isSystem: category.isSystem, isActive: category.isActive })),
    budgets: budgetDtos,
    recurringRules: recurring.map((rule: any) => ({
      id: asId(rule._id), name: rule.name, interval: rule.interval, nextDueDate: new Date(rule.nextDueDate).toISOString(),
      lastBookedPeriod: rule.lastBookedPeriod || undefined, isActive: rule.isActive,
      entryTemplate: { ...rule.entryTemplate, id: 'template', recognitionDate: new Date(rule.entryTemplate.recognitionDate).toISOString() },
    })),
    projects: projectSummaries,
    cashSeries: createCashSeries(cashEntries, filters.from, filters.to),
    categoryCosts,
    warnings: [...new Set(warnings)],
  }
}
