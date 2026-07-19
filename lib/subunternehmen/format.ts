import type {
  ReceivedInvoiceStatus,
  SubcontractorAssignmentStatus,
} from '@/types/subunternehmen'

export const formatEuro = (value: number): string =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value || 0)

export const formatHours = (value: number): string =>
  `${(value || 0).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} h`

export const formatDate = (value?: string | Date): string => {
  if (!value) return '–'
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) {
    // Bereits formatiertes Datum (YYYY-MM-DD) direkt umdrehen
    const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (m) return `${m[3]}.${m[2]}.${m[1]}`
    return String(value)
  }
  return d.toLocaleDateString('de-DE')
}

export const ASSIGNMENT_STATUS_META: Record<
  SubcontractorAssignmentStatus,
  { label: string; className: string }
> = {
  geplant: {
    label: 'Geplant',
    className: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
  },
  durchgefuehrt: {
    label: 'Durchgeführt',
    className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  },
  bestaetigt: {
    label: 'Bestätigt',
    className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  },
  teilweise_abgerechnet: {
    label: 'Teilweise abgerechnet',
    className: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  },
  vollstaendig_abgerechnet: {
    label: 'Abgerechnet',
    className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  },
}

export const INVOICE_STATUS_META: Record<
  ReceivedInvoiceStatus,
  { label: string; className: string }
> = {
  DRAFT: {
    label: 'Entwurf',
    className: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
  },
  SUBMITTED: {
    label: 'Eingereicht',
    className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  },
  UNDER_REVIEW: {
    label: 'In Prüfung',
    className: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
  },
  CHANGES_REQUESTED: {
    label: 'Rückfrage',
    className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  },
  APPROVED: {
    label: 'Freigegeben',
    className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  },
  REJECTED: {
    label: 'Abgelehnt',
    className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  },
  SCHEDULED_FOR_PAYMENT: {
    label: 'Zur Zahlung vorgesehen',
    className: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
  },
  PAID: {
    label: 'Bezahlt',
    className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  },
  CANCELLED: {
    label: 'Storniert',
    className: 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400',
  },
}

export const PROJECT_STATUS_LABELS: Record<string, string> = {
  aktiv: 'Aktiv',
  abgeschlossen: 'Abgeschlossen',
  fertiggestellt: 'Fertiggestellt',
  geleistet: 'Geleistet',
  teilweise_abgerechnet: 'Teilweise abgerechnet',
  'kein Status': 'Kein Status',
}
