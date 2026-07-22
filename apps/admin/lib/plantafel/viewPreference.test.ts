import { describe, expect, it } from 'vitest'
import { parseViewPreference, serializeViewPreference } from './viewPreference'

describe('parseViewPreference', () => {
  it('übernimmt eine vollständige, gültige Auswahl', () => {
    expect(parseViewPreference('{"view":"project","calendarView":"week"}')).toEqual({
      view: 'project',
      calendarView: 'week',
    })
  })

  it('übernimmt einzelne gültige Felder', () => {
    expect(parseViewPreference('{"view":"team"}')).toEqual({ view: 'team' })
    expect(parseViewPreference('{"calendarView":"month"}')).toEqual({ calendarView: 'month' })
  })

  it('verwirft unbekannte Werte, statt sie durchzureichen', () => {
    expect(parseViewPreference('{"view":"admin","calendarView":"decade"}')).toEqual({})
  })

  it('behält das gültige Feld, wenn nur eines beschädigt ist', () => {
    expect(parseViewPreference('{"view":"project","calendarView":"quartal"}')).toEqual({
      view: 'project',
    })
  })

  it('liefert bei fehlendem, leerem oder kaputtem Inhalt eine leere Auswahl', () => {
    expect(parseViewPreference(null)).toEqual({})
    expect(parseViewPreference('')).toEqual({})
    expect(parseViewPreference('kein json')).toEqual({})
    expect(parseViewPreference('null')).toEqual({})
    expect(parseViewPreference('"project"')).toEqual({})
    expect(parseViewPreference('[]')).toEqual({})
  })
})

describe('serializeViewPreference', () => {
  it('schreibt eine Auswahl, die sich unverändert zurücklesen lässt', () => {
    const preference = { view: 'project', calendarView: 'week' } as const
    expect(parseViewPreference(serializeViewPreference(preference))).toEqual(preference)
  })
})
