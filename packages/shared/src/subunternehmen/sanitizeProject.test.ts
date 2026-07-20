import { describe, expect, test } from 'vitest'
import {
  sanitizeProjectForSubcontractor,
  projectBelongsToCompany,
} from './sanitizeProject'
import { toSubcontractorAssignments, buildAssignmentKey } from './assignments'

const COMPANY_A = '64b000000000000000000001'
const COMPANY_B = '64b000000000000000000002'

const makeProject = () => ({
  _id: 'proj1',
  name: 'Gleisbau Musterstadt',
  auftragsnummer: 'A-1000',
  baustelle: 'Musterstadt',
  status: 'aktiv',
  datumBeginn: '2026-07-01',
  datumEnde: '2026-07-31',
  telefonnummer: '0123',
  ansprechpartner: 'Frau Beispiel',
  // Interna, die niemals ins Portal dürfen:
  leistungen: [{ id: 'l1', positionen: [{ id: 'p1', einzelpreis: '999,00' }] }],
  fahrzeuge: { '2026-07-02': [{ licensePlate: 'MH-XX-1' }] },
  dokumente: { all: [{ name: 'intern.pdf' }] },
  mitarbeiterZeiten: {
    '2026-07-02': [
      // Interner Mitarbeiter – darf nicht erscheinen
      { id: 'e1', name: 'Max Intern', funktion: 'SIPO', stunden: 8, start: '07:00', ende: '15:00' },
      // Einsatz von Subunternehmen A
      {
        id: 'e2',
        name: 'Sub A',
        isExternal: true,
        externalCompanyId: COMPANY_A,
        externalCompanyName: 'Sub A GmbH',
        externalCount: 3,
        funktion: 'SIPO',
        stunden: 8,
        sonntag: 0,
        feiertag: 0,
        start: '07:00',
        ende: '15:00',
      },
      // Einsatz von Subunternehmen B – darf für A nicht erscheinen
      {
        id: 'e3',
        name: 'Sub B',
        isExternal: true,
        externalCompanyId: COMPANY_B,
        externalCompanyName: 'Sub B GmbH',
        externalCount: 2,
        funktion: 'HFE',
        stunden: 10,
        start: '06:00',
        ende: '17:00',
      },
    ],
    '2099-01-01': [
      {
        id: 'e4',
        isExternal: true,
        externalCompanyId: COMPANY_A,
        externalCount: 1,
        funktion: 'BüP',
        stunden: 0,
        start: '08:00',
        ende: '16:00',
      },
    ],
  },
})

const options = { today: '2026-07-19', invoicedKeys: new Set<string>() }

describe('projectBelongsToCompany', () => {
  test('erkennt Zugehörigkeit nur über externalCompanyId', () => {
    expect(projectBelongsToCompany(makeProject() as any, COMPANY_A)).toBe(true)
    expect(projectBelongsToCompany(makeProject() as any, '64b0000000000000000000ff')).toBe(false)
  })

  test('interne Einträge zählen nicht als Zugehörigkeit', () => {
    const project = { mitarbeiterZeiten: { '2026-07-01': [{ id: 'x', name: 'Intern', stunden: 8 }] } }
    expect(projectBelongsToCompany(project as any, COMPANY_A)).toBe(false)
  })
})

describe('sanitizeProjectForSubcontractor', () => {
  test('liefert nur freigegebene Felder – keine Interna', () => {
    // Act
    const sanitized = sanitizeProjectForSubcontractor(makeProject() as any, COMPANY_A, options)

    // Assert: Whitelist-Felder vorhanden
    expect(sanitized.name).toBe('Gleisbau Musterstadt')
    expect(sanitized.projectNumber).toBe('A-1000')

    // Assert: Interna sind nicht enthalten
    const json = JSON.stringify(sanitized)
    expect(json).not.toContain('einzelpreis')
    expect(json).not.toContain('999,00')
    expect(json).not.toContain('Max Intern')
    expect(json).not.toContain('intern.pdf')
    expect(json).not.toContain('MH-XX-1')
    expect(json).not.toContain('Sub B')
  })

  test('enthält nur Einsätze des eigenen Subunternehmens', () => {
    const sanitized = sanitizeProjectForSubcontractor(makeProject() as any, COMPANY_A, options)
    expect(sanitized.einsaetze).toHaveLength(2)
    expect(sanitized.einsaetze.every((a) => a.projectId === 'proj1')).toBe(true)
    const sipo = sanitized.einsaetze.find((a) => a.funktion === 'SIPO')
    expect(sipo?.count).toBe(3)
    expect(sipo?.stundenTotal).toBe(24)
  })

  test('leitet Einsatzstatus korrekt ab', () => {
    const sanitized = sanitizeProjectForSubcontractor(makeProject() as any, COMPANY_A, options)
    const past = sanitized.einsaetze.find((a) => a.day === '2026-07-02')
    const future = sanitized.einsaetze.find((a) => a.day === '2099-01-01')
    expect(past?.status).toBe('bestaetigt')
    expect(future?.status).toBe('geplant')
  })

  test('markiert abgerechnete Einsätze', () => {
    const project = makeProject()
    const assignments = toSubcontractorAssignments(project as any, COMPANY_A, options)
    const invoicedKeys = new Set([assignments[0].assignmentKey])
    const sanitized = sanitizeProjectForSubcontractor(project as any, COMPANY_A, {
      today: '2026-07-19',
      invoicedKeys,
    })
    const invoiced = sanitized.einsaetze.find((a) => a.assignmentKey === assignments[0].assignmentKey)
    expect(invoiced?.status).toBe('vollstaendig_abgerechnet')
  })
})

describe('buildAssignmentKey', () => {
  test('ist stabil und eindeutig je Projekt/Zeile', () => {
    expect(buildAssignmentKey('p1', '2026-07-02::e2::SIPO')).toBe('p1::2026-07-02::e2::SIPO')
  })
})
