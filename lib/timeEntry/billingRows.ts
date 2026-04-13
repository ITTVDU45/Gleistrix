export type ExternalWorkerFunctionLike = {
  workerIndex?: number
  funktion?: string
}

export type TimeEntryLike = {
  id?: string
  name?: string
  funktion?: string
  start?: string
  ende?: string
  stunden?: number | string
  fahrtstunden?: number | string
  pause?: string | number
  extra?: number | string
  nachtzulage?: number | string
  sonntag?: number | string
  sonntagsstunden?: number | string
  feiertag?: number | string
  bemerkung?: string
  isExternal?: boolean
  externalCompanyId?: string
  externalCompanyName?: string
  externalCount?: number | string
  externalWorkerFunctions?: ExternalWorkerFunctionLike[]
}

export type BillingRow = {
  rowKey: string
  sourceEntryId: string
  day: string
  isExternal: boolean
  companyName?: string
  employeeName?: string
  funktion: string
  count: number
  start: string
  ende: string
  pause: string
  bemerkung: string
  stundenPerUnit: number
  stundenTotal: number
  fahrtstundenPerUnit: number
  fahrtstundenTotal: number
  nachtzulagePerUnit: number
  nachtzulageTotal: number
  sonntagsstundenPerUnit: number
  sonntagsstundenTotal: number
  feiertagPerUnit: number
  feiertagTotal: number
  extraPerUnit: number
  extraTotal: number
  sourceEntry: TimeEntryLike
}

const toNumber = (value: unknown): number => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value === 'string') {
    const parsed = parseFloat(value.replace(',', '.'))
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

const toPositiveInt = (value: unknown, fallback = 1): number => {
  const n = Math.floor(toNumber(value))
  return n > 0 ? n : fallback
}

const normalizeExternalFunctionGroups = (entry: TimeEntryLike): Array<{ funktion: string; count: number }> => {
  const groups = new Map<string, number>()
  const rows = Array.isArray(entry.externalWorkerFunctions) ? entry.externalWorkerFunctions : []

  rows.forEach((row) => {
    const funktion = String(row?.funktion || '').trim()
    if (!funktion) return
    groups.set(funktion, (groups.get(funktion) || 0) + 1)
  })

  if (groups.size === 0) {
    const fallbackFunction = String(entry.funktion || '').trim() || 'Unbekannt'
    const fallbackCount = toPositiveInt(entry.externalCount, 1)
    groups.set(fallbackFunction, fallbackCount)
  }

  return Array.from(groups.entries())
    .sort((a, b) => a[0].localeCompare(b[0], 'de'))
    .map(([funktion, count]) => ({ funktion, count }))
}

const buildRow = (
  day: string,
  sourceEntry: TimeEntryLike,
  funktion: string,
  count: number,
  rowIndex: number,
  isExternal: boolean
): BillingRow => {
  const sourceEntryId = String(sourceEntry.id || `${day}-${sourceEntry.name || 'entry'}-${rowIndex}`)

  const stundenPerUnit = toNumber(sourceEntry.stunden)
  const fahrtstundenPerUnit = toNumber(sourceEntry.fahrtstunden)
  const nachtzulagePerUnit = toNumber(sourceEntry.nachtzulage)
  const sonntagsstundenPerUnit = toNumber(
    sourceEntry.sonntagsstunden !== undefined ? sourceEntry.sonntagsstunden : sourceEntry.sonntag
  )
  const feiertagPerUnit = toNumber(sourceEntry.feiertag)
  const extraPerUnit = toNumber(sourceEntry.extra)

  return {
    rowKey: `${day}::${sourceEntryId}::${funktion}`,
    sourceEntryId,
    day,
    isExternal,
    companyName: isExternal ? String(sourceEntry.externalCompanyName || sourceEntry.name || '').trim() : undefined,
    employeeName: isExternal ? undefined : String(sourceEntry.name || '').trim(),
    funktion,
    count,
    start: String(sourceEntry.start || ''),
    ende: String(sourceEntry.ende || ''),
    pause: String(sourceEntry.pause || ''),
    bemerkung: String(sourceEntry.bemerkung || ''),
    stundenPerUnit,
    stundenTotal: stundenPerUnit * count,
    fahrtstundenPerUnit,
    fahrtstundenTotal: fahrtstundenPerUnit * count,
    nachtzulagePerUnit,
    nachtzulageTotal: nachtzulagePerUnit * count,
    sonntagsstundenPerUnit,
    sonntagsstundenTotal: sonntagsstundenPerUnit * count,
    feiertagPerUnit,
    feiertagTotal: feiertagPerUnit * count,
    extraPerUnit,
    extraTotal: extraPerUnit * count,
    sourceEntry,
  }
}

export const normalizeTimeEntryToBillingRows = (day: string, entry: TimeEntryLike): BillingRow[] => {
  if (!entry) return []
  const isExternal = Boolean(entry.isExternal)

  if (!isExternal) {
    const funktion = String(entry.funktion || '').trim() || 'Unbekannt'
    return [buildRow(day, entry, funktion, 1, 0, false)]
  }

  return normalizeExternalFunctionGroups(entry).map((group, idx) =>
    buildRow(day, entry, group.funktion, group.count, idx, true)
  )
}

export const normalizeProjectTimeEntriesToBillingRows = (
  mitarbeiterZeiten: Record<string, TimeEntryLike[] | undefined>,
  filterDays?: string[]
): BillingRow[] => {
  const dayFilter = Array.isArray(filterDays) && filterDays.length > 0 ? new Set(filterDays.map(String)) : null
  const rows: BillingRow[] = []

  Object.entries(mitarbeiterZeiten || {}).forEach(([day, entries]) => {
    if (dayFilter && !dayFilter.has(String(day))) return
    ;(Array.isArray(entries) ? entries : []).forEach((entry) => {
      rows.push(...normalizeTimeEntryToBillingRows(day, entry || {}))
    })
  })

  return rows
}

export const summarizeBillingRowsByFunction = (rows: BillingRow[]): string => {
  const map = new Map<string, number>()
  rows.forEach((row) => {
    const key = String(row.funktion || '').trim()
    if (!key) return
    map.set(key, (map.get(key) || 0) + (row.count || 1))
  })
  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0], 'de'))
    .map(([funktion, count]) => `${count}x ${funktion}`)
    .join(', ')
}
