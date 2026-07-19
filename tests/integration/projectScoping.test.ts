import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest'
import mongoose from 'mongoose'
import { connectTestDb, disconnectTestDb, clearCollections } from './helpers/db'
import { Project } from '@/lib/models/Project'
import { Subcompany } from '@/lib/models/Subcompany'
import { findProjectsForCompany } from '@/lib/subunternehmen/queries'
import { sanitizeProjectForSubcontractor } from '@/lib/subunternehmen/sanitizeProject'
import { syncProjectExternalCompanyIds } from '@/lib/subunternehmen/syncExternalCompanyIds'

let companyA: string
let companyB: string

const externalEntry = (companyId: string, overrides: Record<string, unknown> = {}) => ({
  id: `e-${Math.random().toString(36).slice(2, 8)}`,
  name: 'Sub',
  isExternal: true,
  externalCompanyId: companyId,
  externalCount: 2,
  funktion: 'SIPO',
  stunden: 8,
  start: '07:00',
  ende: '15:00',
  ...overrides,
})

const baseProject = (name: string, mitarbeiterZeiten: Record<string, unknown>) => ({
  name,
  auftraggeber: 'DB',
  baustelle: 'Musterstadt',
  auftragsnummer: `A-${name}`,
  sapNummer: 'SAP-1',
  telefonnummer: '0123',
  datumBeginn: '2026-01-01',
  datumEnde: '2026-12-31',
  status: 'aktiv',
  mitarbeiterZeiten,
})

beforeAll(async () => {
  await connectTestDb()
})

afterAll(async () => {
  await disconnectTestDb()
})

beforeEach(async () => {
  await clearCollections()
  const a = await Subcompany.create({ name: `Sub A ${Date.now()}`, employeeCount: 5 })
  const b = await Subcompany.create({ name: `Sub B ${Date.now()}`, employeeCount: 3 })
  companyA = String(a._id)
  companyB = String(b._id)
})

describe('Materialisierung von externalCompanyIds', () => {
  test('pre-save-Hook befüllt das indizierte Feld beim Anlegen', async () => {
    const project = await Project.create(
      baseProject('P1', {
        '2026-07-01': [
          { id: 'i1', name: 'Max Intern', funktion: 'SIPO', stunden: 8 },
          externalEntry(companyA),
          externalEntry(companyB),
        ],
      })
    )
    const raw = await mongoose.connection.db!.collection('projects').findOne({ _id: project._id })
    expect(raw?.externalCompanyIds?.slice().sort()).toEqual([companyA, companyB].sort())
  })

  test('syncProjectExternalCompanyIds zieht findByIdAndUpdate-Pfade nach', async () => {
    const project = await Project.create(baseProject('P2', {}))
    // $push umgeht den pre-save-Hook (wie im Zeiten-Bulk-Endpunkt)
    const updated = await Project.findByIdAndUpdate(
      project._id,
      { $push: { 'mitarbeiterZeiten.2026-07-02': externalEntry(companyA) } },
      { new: true }
    )
    expect(updated).not.toBeNull()

    await syncProjectExternalCompanyIds(updated!)
    const raw = await mongoose.connection.db!.collection('projects').findOne({ _id: project._id })
    expect(raw?.externalCompanyIds).toEqual([companyA])
  })
})

describe('findProjectsForCompany (indizierte Query + Legacy-Fallback)', () => {
  test('liefert nur Projekte des eigenen Subunternehmens', async () => {
    await Project.create(
      baseProject('Nur-A', { '2026-07-01': [externalEntry(companyA)] })
    )
    await Project.create(
      baseProject('Nur-B', { '2026-07-01': [externalEntry(companyB)] })
    )
    await Project.create(baseProject('Ohne-Extern', {}))

    const forA = await findProjectsForCompany(companyA)
    expect(forA.map((p) => p.name)).toEqual(['Nur-A'])

    const forB = await findProjectsForCompany(companyB)
    expect(forB.map((p) => p.name)).toEqual(['Nur-B'])
  })

  test('findet Altbestände ohne externalCompanyIds-Feld (Fallback vor Backfill)', async () => {
    // Legacy-Dokument direkt (ohne Mongoose-Hooks) einfügen
    await mongoose.connection.db!.collection('projects').insertOne(
      baseProject('Legacy', { '2026-07-01': [externalEntry(companyA)] }) as never
    )
    const forA = await findProjectsForCompany(companyA)
    expect(forA.map((p) => p.name)).toEqual(['Legacy'])

    // Fremdes Subunternehmen sieht das Legacy-Projekt nicht
    const forB = await findProjectsForCompany(companyB)
    expect(forB).toEqual([])
  })
})

describe('Sanitisierung gegen echte Dokumente', () => {
  test('interne Daten und fremde Subunternehmen leaken nicht', async () => {
    await Project.create({
      ...baseProject('Leak-Check', {
        '2020-01-01': [
          { id: 'i1', name: 'Max Intern', funktion: 'SIPO', stunden: 8 },
          externalEntry(companyA, { externalCompanyName: 'Sub A GmbH' }),
          externalEntry(companyB, { externalCompanyName: 'Sub B GmbH' }),
        ],
      }),
      leistungen: [{ id: 'l1', positionen: [{ id: 'p1', einzelpreis: '999,00' }] }],
    })

    const [project] = await findProjectsForCompany(companyA)
    const sanitized = sanitizeProjectForSubcontractor(project, companyA, {
      today: '2026-07-19',
      invoicedKeys: new Set(),
    })

    const json = JSON.stringify(sanitized)
    expect(json).not.toContain('Max Intern')
    expect(json).not.toContain('Sub B')
    expect(json).not.toContain('einzelpreis')
    expect(json).not.toContain('999,00')
    expect(sanitized.einsaetze).toHaveLength(1)
    expect(sanitized.einsaetze[0].status).toBe('bestaetigt')
  })
})
