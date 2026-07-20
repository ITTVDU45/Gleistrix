/**
 * Regressionstests: Dokumenten-Upload des Portals prüft Eigentum (IDOR)
 * und Autorisierung – auf Ebene des echten Route-Handlers (Session via
 * getToken gemockt, Daten in echter Test-MongoDB).
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

describe('Dokumenten-Upload prüft Eigentum (IDOR)', () => {
  const loginAsSubA = () =>
    asToken({ id: String(subUserA), role: 'subunternehmen', name: 'Owner A', email: 'a@sub.example' })

  test('fremde invoiceId wird mit 404 abgelehnt', async () => {
    loginAsSubA()
    const foreignInvoice = await ReceivedInvoice.create({
      subcontractorCompanyId: companyB,
      createdByUserId: new mongoose.Types.ObjectId(),
      invoiceNumber: 'RE-B-0001',
      invoiceDate: new Date('2026-07-01'),
      lineItems: [],
      subtotalNet: 0,
      totalVat: 0,
      totalGross: 0,
      status: 'SUBMITTED',
      version: 1,
    })

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
