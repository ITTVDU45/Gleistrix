import {
  DEFAULT_RETURN_REMINDER_CONFIG,
  type ReturnReminderConfig,
  type ReturnReminderInterval,
  type ReturnReminderUnit,
} from '@/lib/notificationDefs'

const VALID_UNITS = new Set<ReturnReminderUnit>(['days', 'weeks', 'months'])
const MAX_INTERVALS = 32
const MAX_VALUE_BY_UNIT: Record<ReturnReminderUnit, number> = {
  days: 3650,
  weeks: 520,
  months: 120,
}

function safeId(raw: unknown, interval: Pick<ReturnReminderInterval, 'value' | 'unit'>): string {
  const value = typeof raw === 'string' ? raw.trim().replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 80) : ''
  return value || `${interval.unit}-${interval.value}`
}

export function normalizeReturnReminderConfig(raw: unknown): ReturnReminderConfig {
  const input = raw && typeof raw === 'object' && Array.isArray((raw as { intervals?: unknown }).intervals)
    ? (raw as { intervals: unknown[] }).intervals
    : DEFAULT_RETURN_REMINDER_CONFIG.intervals

  const seen = new Set<string>()
  const intervals: ReturnReminderInterval[] = []

  for (const candidate of input) {
    if (!candidate || typeof candidate !== 'object') continue
    const row = candidate as Record<string, unknown>
    const unit = row.unit as ReturnReminderUnit
    const value = Number(row.value)
    if (!VALID_UNITS.has(unit) || !Number.isInteger(value) || value < 0 || value > MAX_VALUE_BY_UNIT[unit]) continue

    // Zwei identische Regeln sollen nie zwei Benachrichtigungen erzeugen.
    const signature = `${unit}:${value}`
    if (seen.has(signature)) continue
    seen.add(signature)
    intervals.push({
      id: safeId(row.id, { unit, value }),
      value,
      unit,
      enabled: row.enabled !== false,
    })
    if (intervals.length >= MAX_INTERVALS) break
  }

  return { intervals }
}

export function calendarDateKeyInTimeZone(date: Date, timeZone = 'Europe/Berlin'): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

export function dueDateKey(date: Date): string {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-')
}

function subtractMonthsClamped(date: Date, months: number): Date {
  const sourceYear = date.getUTCFullYear()
  const sourceMonth = date.getUTCMonth()
  const sourceDay = date.getUTCDate()
  const targetMonthIndex = sourceMonth - months
  const targetYear = sourceYear + Math.floor(targetMonthIndex / 12)
  const targetMonth = ((targetMonthIndex % 12) + 12) % 12
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate()
  return new Date(Date.UTC(targetYear, targetMonth, Math.min(sourceDay, lastDay)))
}

export function getReturnReminderTriggerDate(
  dueDate: Date,
  interval: Pick<ReturnReminderInterval, 'value' | 'unit'>
): string {
  const due = new Date(Date.UTC(dueDate.getUTCFullYear(), dueDate.getUTCMonth(), dueDate.getUTCDate()))
  if (interval.unit === 'months') return dueDateKey(subtractMonthsClamped(due, interval.value))

  const days = interval.unit === 'weeks' ? interval.value * 7 : interval.value
  due.setUTCDate(due.getUTCDate() - days)
  return dueDateKey(due)
}

export function isReturnReminderDue(
  dueDate: Date,
  interval: Pick<ReturnReminderInterval, 'value' | 'unit'>,
  now = new Date(),
  timeZone = 'Europe/Berlin'
): boolean {
  return getReturnReminderTriggerDate(dueDate, interval) === calendarDateKeyInTimeZone(now, timeZone)
}

export function returnReminderIntervalLabel(
  interval: Pick<ReturnReminderInterval, 'value' | 'unit'>
): string {
  if (interval.unit === 'days') {
    if (interval.value === 0) return 'am Rückgabetag'
    if (interval.value === 1) return '1 Tag vorher'
    return `${interval.value} Tage vorher`
  }
  if (interval.unit === 'weeks') {
    return interval.value === 1 ? '1 Woche vorher' : `${interval.value} Wochen vorher`
  }
  return interval.value === 1 ? '1 Monat vorher' : `${interval.value} Monate vorher`
}

export function returnReminderMessage(articleName: string, employeeName: string, dueDate: Date): string {
  const formattedDueDate = new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(dueDate)
  return `${articleName} ist von ${employeeName} bis ${formattedDueDate} zurückzugeben.`
}

export function maxReminderHorizonDays(intervals: ReturnReminderInterval[]): number {
  return intervals.reduce((max, interval) => {
    const days = interval.unit === 'months'
      ? interval.value * 32
      : interval.unit === 'weeks'
        ? interval.value * 7
        : interval.value
    return Math.max(max, days)
  }, 0)
}
