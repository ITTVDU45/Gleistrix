import type { EmployeeAbsenceType, VacationDay } from '@/types/main'

export interface EmployeeAbsenceMeta {
  label: string
  shortLabel: string
}

export const EMPLOYEE_ABSENCE_TYPES: ReadonlyArray<{
  value: EmployeeAbsenceType
  label: string
}> = [
  { value: 'urlaub', label: 'Urlaub' },
  { value: 'arbeitsunfaehigkeit', label: 'Arbeitsunfähigkeit (AU)' },
  { value: 'unbezahlte_freistellung', label: 'Unbezahlte Freistellung' },
  { value: 'fortbildung', label: 'Fortbildung' },
]

export const EMPLOYEE_ABSENCE_META: Record<EmployeeAbsenceType, EmployeeAbsenceMeta> = {
  urlaub: { label: 'Urlaub', shortLabel: 'Urlaub' },
  arbeitsunfaehigkeit: { label: 'Arbeitsunfähigkeit (AU)', shortLabel: 'AU' },
  unbezahlte_freistellung: { label: 'Unbezahlte Freistellung', shortLabel: 'U. Freistellung' },
  fortbildung: { label: 'Fortbildung', shortLabel: 'Fortbildung' },
}

const ABSENCE_TYPES = new Set<EmployeeAbsenceType>(
  EMPLOYEE_ABSENCE_TYPES.map((option) => option.value)
)

/**
 * Alte Einträge besitzen noch kein Typfeld. Für sie bleibt die bisherige
 * Stichwort-Erkennung erhalten; neue Einträge verwenden immer den echten Typ.
 */
export function getEmployeeAbsenceType(absence: Pick<VacationDay, 'type' | 'reason'>): EmployeeAbsenceType {
  if (absence.type && ABSENCE_TYPES.has(absence.type)) return absence.type

  const note = (absence.reason || '').toLocaleLowerCase('de-DE')
  if (note.includes('fortbildung') || note.includes('schulung')) return 'fortbildung'
  if (note.includes('unbezahlt') || note.includes('freistellung')) return 'unbezahlte_freistellung'
  if (
    note.includes('arbeitsunfähig') ||
    note.includes('arbeitsunfaehig') ||
    note.includes('krank') ||
    /(^|\W)au($|\W)/i.test(note)
  ) {
    return 'arbeitsunfaehigkeit'
  }
  return 'urlaub'
}

export function getEmployeeAbsenceMeta(absence: Pick<VacationDay, 'type' | 'reason'>): EmployeeAbsenceMeta {
  return EMPLOYEE_ABSENCE_META[getEmployeeAbsenceType(absence)]
}

export function formatEmployeeAbsenceConflict(employeeName: string, absence: VacationDay): string {
  const note = absence.reason?.trim()
  return `${employeeName} ist wegen ${getEmployeeAbsenceMeta(absence).label} nicht verfügbar${note ? ` (${note})` : ''}.`
}

function localDateKey(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function toAbsenceDateKey(value: Date | string): string {
  if (typeof value === 'string') {
    const match = value.match(/^(\d{4}-\d{2}-\d{2})/)
    if (match) return match[1]
  }
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? '' : localDateKey(date)
}

export function findEmployeeAbsenceOnDay(
  absences: VacationDay[] | undefined,
  day: Date | string
): VacationDay | undefined {
  const dayKey = toAbsenceDateKey(day)
  if (!dayKey) return undefined
  return (absences || []).find((absence) => {
    if (absence.approved === false) return false
    const startKey = toAbsenceDateKey(absence.startDate)
    const endKey = toAbsenceDateKey(absence.endDate)
    return Boolean(startKey && endKey && startKey <= dayKey && dayKey <= endKey)
  })
}

export function findEmployeeAbsenceDuringPeriod(
  absences: VacationDay[] | undefined,
  start: Date | string,
  end: Date | string
): VacationDay | undefined {
  const startKey = toAbsenceDateKey(start)
  const endKey = toAbsenceDateKey(end)
  if (!startKey || !endKey) return undefined
  return (absences || []).find((absence) => {
    if (absence.approved === false) return false
    const absenceStart = toAbsenceDateKey(absence.startDate)
    const absenceEnd = toAbsenceDateKey(absence.endDate)
    return Boolean(absenceStart && absenceEnd && absenceStart <= endKey && absenceEnd >= startKey)
  })
}
