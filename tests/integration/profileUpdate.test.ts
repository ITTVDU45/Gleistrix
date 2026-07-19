import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import mongoose from 'mongoose'
import { NextRequest } from 'next/server'
import { connectTestDb, disconnectTestDb, clearCollections } from './helpers/db'

vi.mock('next-auth/jwt', () => ({ getToken: vi.fn() }))
import { getToken } from 'next-auth/jwt'

import User from '@/lib/models/User'
import SuperadminProfile from '@/lib/models/SuperadminProfile'
import { ENV_SUPERADMIN_JWT_ID } from '@/lib/auth/envSuperadmin'
import { requireAdminUser } from '@/lib/auth/requireAdminUser'
import { getCurrentUser } from '@/lib/auth/getCurrentUser'
import { PUT as updateProfile } from '@/app/api/auth/update-profile/route'
import { GET as getMe } from '@/app/api/auth/me/route'

const mockedGetToken = vi.mocked(getToken)
const asToken = (payload: Record<string, unknown>) => mockedGetToken.mockResolvedValue(payload as never)

const putReq = (body: Record<string, unknown>) =>
  new NextRequest('http://localhost/api/auth/update-profile', {
    method: 'PUT',
    headers: { 'content-type': 'application/json', 'x-csrf-intent': 'auth:update-profile' },
    body: JSON.stringify(body),
  })

beforeAll(async () => {
  await connectTestDb()
  ;(globalThis as unknown as { mongooseCache: unknown }).mongooseCache = {
    conn: mongoose,
    promise: Promise.resolve(mongoose),
  }
})

afterAll(async () => {
  await disconnectTestDb()
})

beforeEach(async () => {
  vi.clearAllMocks()
  await clearCollections()
})

describe('ENV-Superadmin (kein DB-Dokument)', () => {
  const login = () =>
    asToken({ id: ENV_SUPERADMIN_JWT_ID, role: 'superadmin', email: 'software@muelheimer-wachdienst.de', name: 'Super Admin' })

  test('Name/Telefon werden gespeichert statt 500', async () => {
    login()
    const res = await updateProfile(putReq({ name: 'Tolgahan Vardar', email: 'egal@x.de', phone: '01785428363' }))
    expect(res.status).toBe(200)

    const doc = await SuperadminProfile.findOne({ scope: 'env-superadmin' }).lean() as { name?: string; phone?: string } | null
    expect(doc?.name).toBe('Tolgahan Vardar')
    expect(doc?.phone).toBe('01785428363')
  })

  test('/api/auth/me liefert die gespeicherten Werte (auch für Sidebar)', async () => {
    login()
    await updateProfile(putReq({ name: 'Neuer Name', phone: '017600000' }))

    const meRes = await getMe(new NextRequest('http://localhost/api/auth/me'))
    const body = await meRes.json()
    expect(body.user.name).toBe('Neuer Name')
    expect(body.user.phone).toBe('017600000')
    expect(body.user.email).toBe('software@muelheimer-wachdienst.de')
  })

  test('gespeicherter Name wirkt in requireAdminUser (Einladungs-Mail) und getCurrentUser', async () => {
    login()
    await updateProfile(putReq({ name: 'Tolgahan Vardar', phone: '0170' }))

    const req = new NextRequest('http://localhost/api/x')
    const admin = await requireAdminUser(req)
    expect(admin.ok && admin.user.name).toBe('Tolgahan Vardar')

    const current = await getCurrentUser(req)
    expect(current?.name).toBe('Tolgahan Vardar')
  })
})

describe('DB-Benutzer: E-Mail ist read-only', () => {
  test('E-Mail bleibt unverändert, Name/Telefon werden gespeichert', async () => {
    const user = await User.create({
      email: 'admin@intern.example',
      password: 'x'.repeat(20),
      name: 'Alt Name',
      role: 'admin',
      isActive: true,
    })
    asToken({ id: String(user._id), role: 'admin', email: user.email })

    const res = await updateProfile(
      putReq({ name: 'Neu Name', email: 'HACK@fremd.example', phone: '0123' })
    )
    expect(res.status).toBe(200)

    const updated = await User.findById(user._id).lean() as { email?: string; name?: string; phone?: string } | null
    expect(updated?.email).toBe('admin@intern.example') // NICHT geändert
    expect(updated?.name).toBe('Neu Name')
    expect(updated?.phone).toBe('0123')
  })
})
