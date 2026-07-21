import { describe, expect, it } from 'vitest'
import { formatProjectBarTitle } from './projectLabel'

describe('formatProjectBarTitle', () => {
  it('zeigt zuerst die Auftragsnummer und danach den Projektnamen', () => {
    expect(formatProjectBarTitle('Bahnhof Nord', 'A708563')).toBe('A708563 · Bahnhof Nord')
  })

  it('zeigt ohne Auftragsnummer nur den Projektnamen', () => {
    expect(formatProjectBarTitle('Bahnhof Nord')).toBe('Bahnhof Nord')
  })
})
