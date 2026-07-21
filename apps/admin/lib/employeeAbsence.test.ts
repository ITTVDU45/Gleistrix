import { describe, expect, it } from 'vitest'
import {
  findEmployeeAbsenceDuringPeriod,
  findEmployeeAbsenceOnDay,
  getEmployeeAbsenceMeta,
  getEmployeeAbsenceType,
} from './employeeAbsence'

describe('employeeAbsence', () => {
  it('verwendet den explizit gespeicherten Abwesenheitstyp', () => {
    expect(getEmployeeAbsenceMeta({ type: 'arbeitsunfaehigkeit' }).shortLabel).toBe('AU')
  })

  it('erkennt den Typ alter Einträge weiterhin aus deren Notiz', () => {
    expect(getEmployeeAbsenceType({ reason: 'Unbezahlte Freistellung' })).toBe('unbezahlte_freistellung')
    expect(getEmployeeAbsenceType({ reason: 'Fortbildung in Köln' })).toBe('fortbildung')
    expect(getEmployeeAbsenceType({ reason: 'Krankmeldung' })).toBe('arbeitsunfaehigkeit')
  })

  it('findet Abwesenheiten einschließlich Start- und Endtag', () => {
    const absences = [{
      type: 'urlaub' as const,
      startDate: '2026-07-21T00:00:00.000Z',
      endDate: '2026-07-23T00:00:00.000Z',
    }]
    expect(findEmployeeAbsenceOnDay(absences, '2026-07-21')).toBe(absences[0])
    expect(findEmployeeAbsenceOnDay(absences, '2026-07-23')).toBe(absences[0])
    expect(findEmployeeAbsenceOnDay(absences, '2026-07-24')).toBeUndefined()
  })

  it('erkennt Überschneidungen und ignoriert nicht freigegebene Einträge', () => {
    const approved = {
      type: 'fortbildung' as const,
      startDate: '2026-08-10',
      endDate: '2026-08-12',
    }
    const unapproved = {
      type: 'urlaub' as const,
      startDate: '2026-09-01',
      endDate: '2026-09-02',
      approved: false,
    }
    expect(findEmployeeAbsenceDuringPeriod([approved], '2026-08-09', '2026-08-10')).toBe(approved)
    expect(findEmployeeAbsenceDuringPeriod([unapproved], '2026-09-01', '2026-09-01')).toBeUndefined()
  })
})
