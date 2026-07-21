export const TIME_TRACKING_EXPORT_HEADERS = [
  'Datum',
  'Projektname',
  'Ort',
  'Mitarbeiter',
  'Funktion',
  'Zeit',
  'Gesamtstunden',
  'Pause',
  'Nachtstunden',
  'Sonntagsstunden',
  'Feiertagsstunden',
  'Fahrtstunden',
  'Extra',
  'Projektstatus',
] as const

export type TimeTrackingExportCell = string | number

export type TimeTrackingExportRow = {
  display: string[]
  spreadsheet: TimeTrackingExportCell[]
}

type TimeTrackingEntryLike = Record<string, unknown>

const parseNumber = (value: unknown): number => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  const parsed = parseFloat(String(value ?? '0').replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : 0
}

const getEntryMultiplier = (entry: TimeTrackingEntryLike): number => {
  if (!entry.isExternal) return 1
  const count = parseNumber(entry.externalCount ?? 1)
  return count > 0 ? count : 1
}

const formatHours = (hours: number, separator: ':' | '.' = '.'): string => {
  let wholeHours = Math.floor(hours)
  let minutes = Math.round((hours - wholeHours) * 60)
  if (minutes === 60) {
    wholeHours += 1
    minutes = 0
  }
  return `${wholeHours}${separator}${String(minutes).padStart(2, '0')}`
}

const formatDate = (value: unknown): string => {
  if (!value) return '-'
  const date = new Date(String(value))
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString('de-DE')
}

const formatDateTime = (value: string): string => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

const formatTimeRange = (startValue: unknown, endValue: unknown): string => {
  const start = String(startValue || '')
  const end = String(endValue || '')
  if (!start || !end) return start || end || '-'

  const bothIso = start.includes('T') && end.includes('T')
  if (bothIso && start.slice(0, 10) !== end.slice(0, 10)) {
    return `${formatDateTime(start)} - ${formatDateTime(end)}`
  }

  const startTime = start.includes('T') ? start.slice(11, 16) : start
  const endTime = end.includes('T') ? end.slice(11, 16) : end
  return `${startTime} - ${endTime}`
}

const displayHours = (value: unknown, multiplier = 1, emptyWhenZero = false): string => {
  const isEmpty = value === undefined || value === null || value === ''
  const hours = parseNumber(value) * multiplier
  if (isEmpty || (emptyWhenZero && hours <= 0)) return '-'
  return `${formatHours(hours)}h`
}

const normalizeExtra = (value: unknown, multiplier: number): { display: string; spreadsheet: TimeTrackingExportCell } => {
  if (value === undefined || value === null || value === '') {
    return { display: '-', spreadsheet: '' }
  }

  if (typeof value === 'number') {
    const hours = value * multiplier
    return { display: `${formatHours(hours)}h`, spreadsheet: hours }
  }

  const text = String(value)
  const numericMatch = text.match(/[\d,.]+/)
  if (!numericMatch) return { display: text, spreadsheet: text }

  const hours = parseNumber(numericMatch[0]) * multiplier
  return { display: `${formatHours(hours)}h`, spreadsheet: hours }
}

export const createTimeTrackingExportRows = (
  timeEntries: readonly TimeTrackingEntryLike[]
): TimeTrackingExportRow[] => timeEntries.map((entry) => {
  const multiplier = getEntryMultiplier(entry)
  const totalHours = parseNumber(entry.stunden) * multiplier
  const pauseHours = parseNumber(entry.pause)
  const nightHours = parseNumber(entry.nachtzulage) * multiplier
  const sundayValue = entry.sonntagsstunden ?? entry.sonntag ?? entry.sonntagstunden
  const sundayHours = parseNumber(sundayValue) * multiplier
  const holidayHours = parseNumber(entry.feiertag) * multiplier
  const travelValue = entry.fahrtstunden ?? entry.fahrt
  const travelHours = parseNumber(travelValue) * multiplier
  const extra = normalizeExtra(entry.extra, multiplier)
  const employeeBase = String(entry.externalCompanyName || entry.name || entry.mitarbeiter || '-').trim() || '-'
  const employee = entry.isExternal ? `${employeeBase} (x${multiplier})` : employeeBase

  const commonCells = [
    formatDate(entry.date),
    String(entry.projectName || entry.project || '-'),
    String(entry.ort || entry.location || '-'),
    employee,
    String(entry.funktion || entry.role || entry.position || '-'),
    formatTimeRange(entry.start ?? entry.beginn, entry.ende ?? entry.end),
  ]

  return {
    display: [
      ...commonCells,
      formatHours(totalHours, ':'),
      pauseHours > 0 ? `${formatHours(pauseHours)}h` : '-',
      displayHours(entry.nachtzulage, multiplier),
      displayHours(sundayValue, multiplier),
      displayHours(entry.feiertag, multiplier),
      displayHours(travelValue, multiplier, true),
      extra.display,
      String(entry.status || entry.projectStatus || '-'),
    ],
    spreadsheet: [
      ...commonCells,
      totalHours,
      pauseHours || '',
      entry.nachtzulage === undefined || entry.nachtzulage === null || entry.nachtzulage === '' ? '' : nightHours,
      sundayValue === undefined || sundayValue === null || sundayValue === '' ? '' : sundayHours,
      entry.feiertag === undefined || entry.feiertag === null || entry.feiertag === '' ? '' : holidayHours,
      travelHours > 0 ? travelHours : '',
      extra.spreadsheet,
      String(entry.status || entry.projectStatus || '-'),
    ],
  }
})

const protectCsvFormula = (value: string): string => {
  const trimmed = value.trimStart()
  if (trimmed.length > 1 && /^[=+\-@]/.test(trimmed)) return `'${value}`
  return value
}

const escapeCsvCell = (value: TimeTrackingExportCell): string => {
  const normalized = typeof value === 'number'
    ? String(value).replace('.', ',')
    : protectCsvFormula(value)
  return `"${normalized.replace(/"/g, '""')}"`
}

export const createTimeTrackingCsv = (rows: readonly TimeTrackingExportRow[]): string => {
  const lines = [
    TIME_TRACKING_EXPORT_HEADERS.map(escapeCsvCell).join(';'),
    ...rows.map((row) => row.spreadsheet.map(escapeCsvCell).join(';')),
  ]
  return `\uFEFF${lines.join('\r\n')}`
}

export const createTimeTrackingExportFilename = (extension: 'pdf' | 'xlsx' | 'csv', now = new Date()): string => {
  const timestamp = now.toISOString().slice(0, 19).replace(/[:T]/g, '-')
  return `Zeiterfassung_${timestamp}.${extension}`
}
