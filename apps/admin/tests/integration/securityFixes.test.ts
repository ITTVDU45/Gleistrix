/**
 * Regressionstests für die drei Review-Fixes vom 2026-07-19 – auf Ebene der
 * echten API-Route-Handler (Session via getToken gemockt, Daten in echter
 * Test-MongoDB):
 *
 * 1. Subcompany-DELETE: 409 solange Memberships/Rechnungen existieren
 * 2. User-DELETE: Membership eines subunternehmen-Kontos wird mit entfernt
 * (Upload-IDOR-Tests liegen in apps/portal/tests/integration/uploadSecurity.test.ts)
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
