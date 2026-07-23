import type { FinanceEntryDto } from '@/types/finance'

export const formatMoney = (cents: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(cents / 100)
export const formatDate = (value?: string) => value ? new Intl.DateTimeFormat('de-DE').format(new Date(value)) : '—'
export const dateInput = (value?: string | Date) => {
  const date = value ? new Date(value) : new Date()
  return date.toISOString().slice(0, 10)
}

export const sourceLabels: Record<FinanceEntryDto['source'], string> = {
  manual: 'Manuell', ai_receipt: 'KI-Beleg', recurring: 'Wiederkehrend', bank_csv: 'Bankimport',
  employee_time: 'Arbeitszeit', project_revenue: 'Projektumsatz', subcontractor_estimate: 'Sub-Schätzung', subcontractor_invoice: 'Sub-Rechnung', adjustment: 'Korrektur',
}

export const downloadBlob = (content: BlobPart, fileName: string, type: string) => {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}
