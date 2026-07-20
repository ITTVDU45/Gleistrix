import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest'
import mongoose from 'mongoose'
import { connectTestDb, disconnectTestDb, clearCollections } from './helpers/db'
import { Project } from '@/lib/models/Project'
import { Subcompany } from '@/lib/models/Subcompany'
import ReceivedInvoice from '@/lib/models/ReceivedInvoice'
import { computeDraft } from '@/lib/subunternehmen/invoiceDraft'
import {
  getAssignmentMapForCompany,
  validateLineItemsAgainstAssignments,
  isInvoiceNumberTaken,
} from '@/lib/subunternehmen/invoiceValidation'
import { getInvoicedKeysForCompany } from '@/lib/subunternehmen/queries'
import { buildAssignmentKey } from '@/lib/subunternehmen/assignments'

let companyId: mongoose.Types.ObjectId
let projectId: string
let assignmentKey: string

const DAY = '2020-03-02' // Vergangenheit → Einsatz gilt als bestätigt

beforeAll(async () => {
  await connectTestDb()
  await ReceivedInvoice.syncIndexes()
})

afterAll(async () => {
  await disconnectTestDb()
})

beforeEach(async () => {
  await clearCollections()
  const company = await Subcompany.create({
    name: `Sub ${Date.now()}`,
    employeeCount: 4,
    functionRates: [{ funktion: 'SIPO', hourlyRate: 50 }],
  })
  companyId = company._id

  const project = await Project.create({
    name: 'Gleisbau',
    auftraggeber: 'DB',
    baustelle: 'Musterstadt',
    auftragsnummer: 'A-100',
    sapNummer: 'SAP-1',
    telefonnummer: '0123',
    datumBeginn: '2020-03-01',
    datumEnde: '2020-03-31',
    status: 'aktiv',
    mitarbeiterZeiten: {
      [DAY]: [
        {
          id: 'e1',
          name: 'Sub',
          isExternal: true,
          externalCompanyId: String(company._id),
          externalCount: 3,
          funktion: 'SIPO',
          stunden: 8,
          start: '07:00',
          ende: '15:00',
        },
      ],
    },
  })
  projectId = String(project._id)
  assignmentKey = buildAssignmentKey(projectId, `${DAY}::e1::SIPO`)
})

const draftInput = (key: string | undefined, invoiceNumber: string) => ({
  invoiceNumber,
  invoiceDate: '2026-07-01',
  paymentTermDays: 14,
  lineItems: [
    {
      type: 'HOURS' as const,
      description: '24h SIPO',
      projectId,
      assignmentKey: key,
      serviceDate: DAY,
      quantity: 24,
      unit: 'h' as const,
      unitPrice: 50,
      vatRate: 19,
    },
  ],
})

async function createInvoice(key: string | undefined, invoiceNumber: string, status = 'SUBMITTED') {
  const draft = computeDraft(draftInput(key, invoiceNumber), 19)
  return ReceivedInvoice.create({
    subcontractorCompanyId: companyId,
    createdByUserId: new mongoose.Types.ObjectId(),
    invoiceNumber,
    invoiceDate: draft.invoiceDate,
    projectIds: [new mongoose.Types.ObjectId(projectId)],
    lineItems: draft.lineItems,
    subtotalNet: draft.subtotalNet,
    totalVat: draft.totalVat,
    totalGross: draft.totalGross,
    paymentTermDays: draft.paymentTermDays,
    dueDate: draft.dueDate,
    status,
    version: 1,
  })
}

describe('Einsätze als Rechnungsgrundlage (echte Disposition)', () => {
  test('bestätigter Einsatz ist im Assignment-Index auffindbar', async () => {
    const map = await getAssignmentMapForCompany(companyId)
    const assignment = map.get(assignmentKey)
    expect(assignment).toBeDefined()
    expect(assignment?.status).toBe('bestaetigt')
    expect(assignment?.stundenTotal).toBe(24) // 3 Mitarbeiter × 8 h
  })
})

describe('Serverseitige Summen + Persistenz', () => {
  test('Entwurf wird mit korrekt berechneten Summen gespeichert', async () => {
    const invoice = await createInvoice(assignmentKey, 'RE-2026-0001', 'DRAFT')
    expect(invoice.subtotalNet).toBe(1200)
    expect(invoice.totalVat).toBe(228)
    expect(invoice.totalGross).toBe(1428)
    expect(invoice.dueDate?.toISOString().slice(0, 10)).toBe('2026-07-15')
  })
})

describe('Doppelabrechnungs-Erkennung über echte Rechnungen', () => {
  test('bereits eingereichter Einsatz blockiert eine neue Rechnung', async () => {
    await createInvoice(assignmentKey, 'RE-2026-0001', 'SUBMITTED')

    const draft = computeDraft(draftInput(assignmentKey, 'RE-2026-0002'), 19)
    const result = await validateLineItemsAgainstAssignments(companyId, draft.lineItems)
    expect(result.errors.some((e) => e.includes('RE-2026-0001'))).toBe(true)
  })

  test('stornierte Rechnungen blockieren nicht', async () => {
    await createInvoice(assignmentKey, 'RE-2026-0001', 'CANCELLED')

    const draft = computeDraft(draftInput(assignmentKey, 'RE-2026-0002'), 19)
    const result = await validateLineItemsAgainstAssignments(companyId, draft.lineItems)
    expect(result.errors).toEqual([])
  })

  test('die eigene Rechnung blockiert sich beim Bearbeiten nicht (excludeInvoiceId)', async () => {
    const invoice = await createInvoice(assignmentKey, 'RE-2026-0001', 'DRAFT')
    const draft = computeDraft(draftInput(assignmentKey, 'RE-2026-0001'), 19)
    const result = await validateLineItemsAgainstAssignments(
      companyId,
      draft.lineItems,
      String(invoice._id)
    )
    expect(result.errors).toEqual([])
  })

  test('fremde assignmentKeys werden abgelehnt (IDOR-Schutz)', async () => {
    const foreignKey = buildAssignmentKey(String(new mongoose.Types.ObjectId()), `${DAY}::x::SIPO`)
    const draft = computeDraft(draftInput(foreignKey, 'RE-2026-0003'), 19)
    const result = await validateLineItemsAgainstAssignments(companyId, draft.lineItems)
    expect(result.errors.some((e) => e.includes('nicht Ihrem Unternehmen'))).toBe(true)
  })

  test('getInvoicedKeysForCompany markiert abgerechnete Einsätze', async () => {
    await createInvoice(assignmentKey, 'RE-2026-0001', 'SUBMITTED')
    const { invoicedKeys, invoiceNumbersByKey } = await getInvoicedKeysForCompany(companyId)
    expect(invoicedKeys.has(assignmentKey)).toBe(true)
    expect(invoiceNumbersByKey.get(assignmentKey)).toEqual(['RE-2026-0001'])
  })
})

describe('Rechnungsnummern (Eindeutigkeit + Index)', () => {
  test('isInvoiceNumberTaken erkennt vergebene Nummern, ignoriert stornierte', async () => {
    await createInvoice(assignmentKey, 'RE-2026-0001', 'SUBMITTED')
    expect(await isInvoiceNumberTaken(companyId, 'RE-2026-0001')).toBe(true)
    expect(await isInvoiceNumberTaken(companyId, 'RE-2026-9999')).toBe(false)

    await ReceivedInvoice.updateMany({ subcontractorCompanyId: companyId }, { status: 'CANCELLED' })
    expect(await isInvoiceNumberTaken(companyId, 'RE-2026-0001')).toBe(false)
  })

  test('Unique-Index verhindert doppelte Nummer bei gleicher Version, erlaubt Revisionen', async () => {
    await createInvoice(undefined, 'RE-2026-0001', 'SUBMITTED')
    await expect(createInvoice(undefined, 'RE-2026-0001', 'DRAFT')).rejects.toMatchObject({
      code: 11000,
    })

    // Revision (version 2) derselben Nummer ist zulässig
    const draft = computeDraft(draftInput(undefined, 'RE-2026-0001'), 19)
    await expect(
      ReceivedInvoice.create({
        subcontractorCompanyId: companyId,
        createdByUserId: new mongoose.Types.ObjectId(),
        invoiceNumber: 'RE-2026-0001',
        invoiceDate: draft.invoiceDate,
        lineItems: draft.lineItems,
        subtotalNet: draft.subtotalNet,
        totalVat: draft.totalVat,
        totalGross: draft.totalGross,
        status: 'DRAFT',
        version: 2,
      })
    ).resolves.toBeTruthy()
  })
})
