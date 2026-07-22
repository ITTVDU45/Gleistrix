import { describe, expect, it } from 'vitest'
import {
  getHolidayTitlesByDay,
  getProjectBarSpan,
  getWeekDays,
  getWeekStart,
  sortProjectEvents,
  toDayKey,
} from './projectWeekLayout'

// Referenzwoche: KW 27/2026, Mo 29.06. – So 05.07.
const monday = new Date(2026, 5, 29)
const wednesday = new Date(2026, 6, 1)
const sunday = new Date(2026, 6, 5)

describe('getWeekStart / getWeekDays', () => {
  it('liefert den Montag als Wochenbeginn für jeden Tag der Woche', () => {
    expect(toDayKey(getWeekStart(wednesday))).toBe('2026-06-29')
    expect(toDayKey(getWeekStart(sunday))).toBe('2026-06-29')
  })

  it('liefert die 7 Tage Montag bis Sonntag', () => {
    const days = getWeekDays(wednesday)
    expect(days).toHaveLength(7)
    expect(toDayKey(days[0])).toBe('2026-06-29')
    expect(toDayKey(days[6])).toBe('2026-07-05')
  })
})

describe('getProjectBarSpan', () => {
  it('spannt ein Projekt innerhalb der Woche über seine Kalendertage (inklusive Ende)', () => {
    const span = getProjectBarSpan(
      { start: new Date(2026, 6, 1), end: new Date(2026, 6, 3) },
      monday
    )
    expect(span).toEqual({
      startIndex: 2,
      endIndex: 4,
      continuesBefore: false,
      continuesAfter: false,
    })
  })

  it('schneidet Projekte zu, die vor der Woche beginnen und danach enden', () => {
    const span = getProjectBarSpan(
      { start: new Date(2026, 5, 20), end: new Date(2026, 6, 20) },
      monday
    )
    expect(span).toEqual({
      startIndex: 0,
      endIndex: 6,
      continuesBefore: true,
      continuesAfter: true,
    })
  })

  it('akzeptiert ISO-Strings als Laufzeitgrenzen', () => {
    const span = getProjectBarSpan({ start: '2026-06-29T00:00:00', end: '2026-06-30T00:00:00' }, monday)
    expect(span).toMatchObject({ startIndex: 0, endIndex: 1 })
  })

  it('liefert null für Projekte komplett außerhalb der Woche', () => {
    expect(getProjectBarSpan({ start: new Date(2026, 5, 1), end: new Date(2026, 5, 28) }, monday)).toBeNull()
    expect(getProjectBarSpan({ start: new Date(2026, 6, 6), end: new Date(2026, 6, 10) }, monday)).toBeNull()
  })

  it('zeigt eintägige Projekte als Ein-Tages-Balken', () => {
    const span = getProjectBarSpan(
      { start: new Date(2026, 6, 2), end: new Date(2026, 6, 2) },
      monday
    )
    expect(span).toMatchObject({ startIndex: 3, endIndex: 3 })
  })

  it('fängt invertierte Laufzeiten ab (Ende vor Beginn ergibt mindestens einen Tag)', () => {
    const span = getProjectBarSpan(
      { start: new Date(2026, 6, 2), end: new Date(2026, 6, 1) },
      monday
    )
    expect(span).toMatchObject({ startIndex: 3, endIndex: 3 })
  })
})

describe('getHolidayTitlesByDay', () => {
  const weekDays = getWeekDays(monday)

  it('gruppiert Feiertagstitel nach Tagesschlüssel', () => {
    const events = [
      { sourceType: 'feiertag', title: 'Testfeiertag', start: new Date(2026, 6, 1, 0, 0) },
      { sourceType: 'feiertag', title: 'Zweiter Feiertag', start: new Date(2026, 6, 1, 12, 0) },
      { sourceType: 'feiertag', title: 'Anderer Tag', start: new Date(2026, 6, 3) },
    ]
    const byDay = getHolidayTitlesByDay(events, weekDays)
    expect(byDay.get('2026-07-01')).toEqual(['Testfeiertag', 'Zweiter Feiertag'])
    expect(byDay.get('2026-07-03')).toEqual(['Anderer Tag'])
  })

  it('ignoriert andere Event-Typen und Tage außerhalb der Woche', () => {
    const events = [
      { sourceType: 'projekt', title: 'Kein Feiertag', start: new Date(2026, 6, 1) },
      { sourceType: 'feiertag', title: 'Außerhalb', start: new Date(2026, 6, 10) },
    ]
    expect(getHolidayTitlesByDay(events, weekDays).size).toBe(0)
  })
})

describe('sortProjectEvents', () => {
  it('sortiert nach Laufzeitbeginn und danach alphabetisch, ohne das Original zu verändern', () => {
    const events = [
      { start: new Date(2026, 6, 2), title: 'B-Projekt' },
      { start: new Date(2026, 6, 1), title: 'Z-Projekt' },
      { start: new Date(2026, 6, 2), title: 'A-Projekt' },
    ]
    const sorted = sortProjectEvents(events)
    expect(sorted.map((e) => e.title)).toEqual(['Z-Projekt', 'A-Projekt', 'B-Projekt'])
    expect(events.map((e) => e.title)).toEqual(['B-Projekt', 'Z-Projekt', 'A-Projekt'])
  })
})
