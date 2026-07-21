import { describe, expect, it } from 'vitest'
import {
  getReturnReminderTriggerDate,
  isReturnReminderDue,
  normalizeReturnReminderConfig,
  returnReminderIntervalLabel,
} from './returnReminderSchedule'

describe('returnReminderSchedule', () => {
  it('normalisiert Admin-Regeln und entfernt identische Intervalle', () => {
    expect(normalizeReturnReminderConfig({
      intervals: [
        { id: 'a', value: 5, unit: 'days', enabled: true },
        { id: 'b', value: 5, unit: 'days', enabled: false },
        { id: 'bad', value: -1, unit: 'weeks', enabled: true },
      ],
    })).toEqual({
      intervals: [{ id: 'a', value: 5, unit: 'days', enabled: true }],
    })
  })

  it('berechnet Tage und Wochen vor dem Rückgabetermin', () => {
    const due = new Date('2026-08-31T00:00:00.000Z')
    expect(getReturnReminderTriggerDate(due, { value: 5, unit: 'days' })).toBe('2026-08-26')
    expect(getReturnReminderTriggerDate(due, { value: 2, unit: 'weeks' })).toBe('2026-08-17')
  })

  it('klemmt Kalendermonate am Monatsende korrekt', () => {
    expect(getReturnReminderTriggerDate(
      new Date('2026-03-31T00:00:00.000Z'),
      { value: 1, unit: 'months' }
    )).toBe('2026-02-28')
    expect(getReturnReminderTriggerDate(
      new Date('2024-03-31T00:00:00.000Z'),
      { value: 1, unit: 'months' }
    )).toBe('2024-02-29')
  })

  it('wertet den Geschäftstag in Europe/Berlin aus', () => {
    const due = new Date('2026-07-22T00:00:00.000Z')
    expect(isReturnReminderDue(due, { value: 1, unit: 'days' }, new Date('2026-07-20T22:30:00.000Z'))).toBe(true)
  })

  it('formatiert die Standardzeitpunkte verständlich', () => {
    expect(returnReminderIntervalLabel({ value: 0, unit: 'days' })).toBe('am Rückgabetag')
    expect(returnReminderIntervalLabel({ value: 1, unit: 'weeks' })).toBe('1 Woche vorher')
    expect(returnReminderIntervalLabel({ value: 2, unit: 'months' })).toBe('2 Monate vorher')
  })
})
