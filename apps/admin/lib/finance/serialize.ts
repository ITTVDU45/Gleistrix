const id = (value: unknown) => value ? String(value) : undefined
const iso = (value: unknown) => value ? new Date(value as string | Date).toISOString() : undefined

export function serializeFinanceEntry(entry: any, lookup: {
  categories: Map<string, any>
  accounts: Map<string, any>
  projects: Map<string, any>
  employees: Map<string, any>
  subcompanies: Map<string, any>
}) {
  const categoryId = id(entry.categoryId)
  const accountId = id(entry.accountId)
  const projectId = id(entry.projectId)
  const employeeId = id(entry.employeeId)
  const subcompanyId = id(entry.subcompanyId)
  return {
    id: id(entry._id) || entry.id,
    direction: entry.direction,
    title: entry.title,
    description: entry.description || undefined,
    categoryId,
    categoryName: categoryId ? lookup.categories.get(categoryId)?.name : undefined,
    recognitionDate: iso(entry.recognitionDate)!,
    dueDate: iso(entry.dueDate),
    paidAt: iso(entry.paidAt),
    paymentStatus: entry.paymentStatus,
    ledgerEffect: entry.ledgerEffect,
    source: entry.source,
    sourceKey: entry.sourceKey || undefined,
    netCents: entry.netCents,
    vatCents: entry.vatCents,
    grossCents: entry.grossCents,
    vatRate: entry.vatRate,
    accountId,
    accountName: accountId ? lookup.accounts.get(accountId)?.name : undefined,
    projectId,
    projectName: projectId ? lookup.projects.get(projectId)?.name : undefined,
    employeeId,
    employeeName: employeeId ? lookup.employees.get(employeeId)?.name : undefined,
    subcompanyId,
    subcompanyName: subcompanyId ? lookup.subcompanies.get(subcompanyId)?.name : undefined,
    receivedInvoiceId: id(entry.receivedInvoiceId),
    vehicleId: id(entry.vehicleId),
    materialId: id(entry.materialId),
    reference: entry.reference || undefined,
    invoiceNumber: entry.invoiceNumber || undefined,
    imported: entry.source === 'bank_csv',
  }
}
