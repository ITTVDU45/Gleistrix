/**
 * Regressionstests für die drei Review-Fixes vom 2026-07-19 – auf Ebene der
 * echten API-Route-Handler (Session via getToken gemockt, Daten in echter
 * Test-MongoDB):
 *
 * 1. Dokumenten-Upload: fremde invoiceId/projectId → 404 (IDOR-Schutz)
 * 2. Subcompany-DELETE: 409 solange Memberships/Rechnungen existieren
 * 3. User-DELETE: Membership eines subunternehmen-Kontos wird mit entfernt
 */
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import mongoose from 'mongoose'
import { NextRequest } from 'next/server'
import { connectTestDb, disconnectTestDb, clearCollections } from './helpers/db'

vi.mock('next-auth/jwt', () => ({ getToken: vi.fn() }))
import { getToken } from 'next-auth/jwt'

import { Subcompany } from '@/lib/models/Subcompany'
import User from '@/lib/models/User'
import SubcontractorMembership from '@/lib/models/SubcontractorMembership'
import ReceivedInvoice from '@/lib/models/ReceivedInvoice'
import { POST as uploadDocument } from '@/app/api/subunternehmen/documents/route'
import { DELETE as deleteSubcompany } from '@/app/api/subcompanies/[id]/route'
import { DELETE as deleteUser } from '@/app/api/users/[id]/route'

const mockedGetToken = vi.mocked(getToken)

const asToken = (payload: Record<string, unknown>) =>
  mockedGetToken.mockResolvedValue(payload as never)

let companyA: mongoose.Types.ObjectId
let companyB: mongoose.Types.ObjectId
let subUserA: mongoose.Types.ObjectId

async function seedBase() {
  const a = await Subcompany.create({ name: `Sub A ${Date.now()}`, employeeCount: 2 })
  const b = await Subcompany.create({ name: `Sub B ${Date.now()}`, employeeCount: 2 })
  companyA = a._id
  companyB = b._id

  const user = await User.create({
    email: `owner-a-${Date.now()}@sub.example`,
    password: 'x'.repeat(20),
    name: 'Owner A',
    role: 'subunternehmen',
    isActive: true,
  })
  subUserA = user._id

  await SubcontractorMembership.create({
    subcontractorCompanyId: companyA,
    userId: subUserA,
    role: 'SUBCONTRACTOR_OWNER',
    status: 'active',
  })
}

const invoiceFor = (companyId: mongoose.Types.ObjectId, invoiceNumber: string) =>
  ReceivedInvoice.create({
    subcontractorCompanyId: companyId,
    createdByUserId: new mongoose.Types.ObjectId(),
    invoiceNumber,
    invoiceDate: new Date('2026-07-01'),
    lineItems: [],
    subtotalNet: 0,
    totalVat: 0,
    totalGross: 0,
    status: 'SUBMITTED',
    version: 1,
  })

function uploadRequest(fields: Record<string, string>): NextRequest {
  const formData = new FormData()
  formData.append(
    'file',
    new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], 'nachweis.pdf', { type: 'application/pdf' })
  )
  formData.append('type', 'SERVICE_PROOF')
  for (const [key, value] of Object.entries(fields)) formData.append(key, value)
  return new NextRequest('http://localhost/api/subunternehmen/documents', {
    method: 'POST',
    body: formData,
  })
}

beforeAll(async () => {
  await connectTestDb()
})

afterAll(async () => {
  await disconnectTestDb()
})

beforeEach(async () => {
  vi.clearAllMocks()
  await clearCollections()
  await seedBase()
})

describe('Fix 1: Dokumenten-Upload prüft Eigentum (IDOR)', () => {
  const loginAsSubA = () =>
    asToken({ id: String(subUserA), role: 'subunternehmen', name: 'Owner A', email: 'a@sub.example' })

  test('fremde invoiceId wird mit 404 abgelehnt', async () => {
    loginAsSubA()
    const foreignInvoice = await invoiceFor(companyB, 'RE-B-0001')

    const res = await uploadDocument(uploadRequest({ invoiceId: String(foreignInvoice._id) }))
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toContain('Rechnung nicht gefunden')
  })

  test('fremde projectId wird mit 404 abgelehnt', async () => {
    loginAsSubA()
    const res = await uploadDocument(
      uploadRequest({ projectId: String(new mongoose.Types.ObjectId()) })
    )
    expect(res.status).toBe(404)
  })

  test('ohne Login wird der Upload abgelehnt', async () => {
    mockedGetToken.mockResolvedValue(null as never)
    const res = await uploadDocument(uploadRequest({}))
    expect(res.status).toBe(401)
  })

  test('interne Rolle darf den Portal-Upload nicht nutzen', async () => {
    asToken({ id: String(new mongoose.Types.ObjectId()), role: 'admin', name: 'Admin' })
    const res = await uploadDocument(uploadRequest({}))
    expect(res.status).toBe(403)
  })
})

describe('Fix 2: Subunternehmen-Löschung blockiert bei Portal-Daten', () => {
  const loginAsAdmin = () => asToken({ id: String(new mongoose.Types.ObjectId()), role: 'admin' })

  const deleteRequest = (companyId: mongoose.Types.ObjectId) =>
    deleteSubcompany(
      new NextRequest(`http://localhost/api/subcompanies/${companyId}`, { method: 'DELETE' })
    )

  test('409 bei vorhandener Membership', async () => {
    loginAsAdmin()
    const res = await deleteRequest(companyA)
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.message).toContain('inaktiv')
    expect(await Subcompany.findById(companyA)).not.toBeNull()
  })

  test('409 bei vorhandener Rechnung (auch ohne Membership)', async () => {
    loginAsAdmin()
    await invoiceFor(companyB, 'RE-B-0002')
    const res = await deleteRequest(companyB)
    expect(res.status).toBe(409)
    expect(await Subcompany.findById(companyB)).not.toBeNull()
  })

  test('Löschen klappt, sobald keine Portal-Daten mehr existieren', async () => {
    loginAsAdmin()
    await SubcontractorMembership.deleteMany({ subcontractorCompanyId: companyA })
    const res = await deleteRequest(companyA)
    expect(res.status).toBe(200)
    expect(await Subcompany.findById(companyA)).toBeNull()
  })
})

describe('Fix 3: Benutzer-Löschung räumt Membership auf', () => {
  test('Membership eines subunternehmen-Kontos wird mitgelöscht', async () => {
    const admin = await User.create({
      email: `admin-${Date.now()}@intern.example`,
      password: 'x'.repeat(20),
      name: 'Admin',
      role: 'admin',
      isActive: true,
    })
    asToken({ id: String(admin._id), role: 'admin', name: 'Admin' })

    expect(await SubcontractorMembership.countDocuments({ userId: subUserA })).toBe(1)

    const res = await deleteUser(
      new NextRequest(`http://localhost/api/users/${subUserA}`, { method: 'DELETE' }),
      { params: Promise.resolve({ id: String(subUserA) }) }
    )
    expect(res.status).toBe(200)
    expect(await User.findById(subUserA)).toBeNull()
    expect(await SubcontractorMembership.countDocuments({ userId: subUserA })).toBe(0)
  })
})
