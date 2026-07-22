import { describe, expect, it } from 'vitest'
import { toggleHolidayState } from './holidayStateSelection'

const ALL = ['BW', 'BY', 'BE']
const allStates = { holidayStates: [], showGermanHolidays: true }
const noStates = { holidayStates: [], showGermanHolidays: false }

describe('toggleHolidayState', () => {
  it('grenzt die leere (= alle) Auswahl beim Abwählen auf die restlichen Länder ein', () => {
    expect(toggleHolidayState(allStates, ALL, 'BY', false)).toEqual({
      holidayStates: ['BW', 'BE'],
      showGermanHolidays: true,
    })
  })

  it('schaltet die deutschen Feiertage ab, wenn das letzte Bundesland abgewählt wird', () => {
    const oneState = { holidayStates: ['BY'], showGermanHolidays: true }
    expect(toggleHolidayState(oneState, ALL, 'BY', false)).toEqual({
      holidayStates: [],
      showGermanHolidays: false,
    })
  })

  it('wählt bei abgeschalteten Feiertagen nur das angehakte Land, nicht alle', () => {
    expect(toggleHolidayState(noStates, ALL, 'BY', true)).toEqual({
      holidayStates: ['BY'],
      showGermanHolidays: true,
    })
  })

  it('normalisiert die vollständige Auswahl auf die leere Standardauswahl', () => {
    const twoStates = { holidayStates: ['BW', 'BY'], showGermanHolidays: true }
    expect(toggleHolidayState(twoStates, ALL, 'BE', true)).toEqual({
      holidayStates: [],
      showGermanHolidays: true,
    })
  })

  it('behält die Reihenfolge aus GERMAN_STATES bei', () => {
    const oneState = { holidayStates: ['BE'], showGermanHolidays: true }
    expect(toggleHolidayState(oneState, ALL, 'BW', true).holidayStates).toEqual(['BW', 'BE'])
  })

  it('ignoriert das Abwählen eines nicht ausgewählten Bundeslands', () => {
    const oneState = { holidayStates: ['BW'], showGermanHolidays: true }
    expect(toggleHolidayState(oneState, ALL, 'BY', false)).toEqual({
      holidayStates: ['BW'],
      showGermanHolidays: true,
    })
  })
})
