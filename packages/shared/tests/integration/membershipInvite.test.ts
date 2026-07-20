import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest'
import mongoose from 'mongoose'
import { connectTestDb, disconnectTestDb, clearCollections } from './helpers/db'
import { Subcompany } from '@/lib/models/Subcompany'
import SubcontractorMembership from '@/lib/models/SubcontractorMembership'
import InviteToken from '@/lib/models/InviteToken'
import { generateInviteToken, hashInviteToken, validateInviteState } from '@/lib/subunternehmen/inviteToken'

let companyId: mongoose.Types.ObjectId
const userId = () => new mongoose.Types.ObjectId()

beforeAll(async () => {
  await connectTestDb()
  // Unique-Indizes müssen für die Constraint-Tests real existieren
  await SubcontractorMembership.syncIndexes()
  await InviteToken.syncIndexes()
})

afterAll(async () => {
  await disconnectTestDb()
})

beforeEach(async () => {
  await clearCollections()
  const company = await Subcompany.create({ name: `Sub ${Date.now()}`, employeeCount: 2 })
  companyId = company._id
})

describe('Membership-Eindeutigkeit (Unique-Index)', () => {
  test('keine doppelte Membership pro Benutzer und Subunternehmen', async () => {
    const uid = userId()
    await SubcontractorMembership.create({
      subcontractorCompanyId: companyId,
      userId: uid,
      role: 'SUBCONTRACTOR_OWNER',
      status: 'active',
    })
    await expect(
      SubcontractorMembership.create({
        subcontractorCompanyId: companyId,
        userId: uid,
        role: 'SUBCONTRACTOR_USER',
        status: 'active',
      })
    ).rejects.toMatchObject({ code: 11000 })
  })

  test('unterschiedliche Benutzer im selben Subunternehmen sind erlaubt', async () => {
    await SubcontractorMembership.create({
      subcontractorCompanyId: companyId,
      userId: userId(),
      role: 'SUBCONTRACTOR_OWNER',
      status: 'active',
    })
    await expect(
      SubcontractorMembership.create({
        subcontractorCompanyId: companyId,
        userId: userId(),
        role: 'SUBCONTRACTOR_USER',
        status: 'invited',
      })
    ).resolves.toBeTruthy()
  })
})

describe('Einladungs-Token (nur Hash in der DB, einmalig)', () => {
  const createInvite = (tokenHash: string, overrides: Record<string, unknown> = {}) =>
    InviteToken.create({
      email: 'owner@sub.example',
      role: 'subunternehmen',
      token: tokenHash,
      tokenHash,
      invitationType: 'SUBCONTRACTOR',
      subcontractorCompanyId: companyId,
      subcontractorRole: 'SUBCONTRACTOR_OWNER',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      ...overrides,
    })

  test('Klartext-Token liegt nie in der Datenbank', async () => {
    const { token, tokenHash } = generateInviteToken()
    await createInvite(tokenHash)

    const raw = await mongoose.connection.db!.collection('inviteTokens').findOne({ tokenHash })
    expect(raw?.token).toBe(tokenHash)
    expect(JSON.stringify(raw)).not.toContain(token)
    // Lookup funktioniert ausschließlich über den Hash des Klartext-Tokens
    const found = await InviteToken.findOne({ tokenHash: hashInviteToken(token) })
    expect(String(found?._id)).toBe(String(raw?._id))
  })

  test('derselbe Token-Hash kann nicht zweimal existieren', async () => {
    const { tokenHash } = generateInviteToken()
    await createInvite(tokenHash)
    await expect(createInvite(tokenHash, { email: 'zweiter@sub.example' })).rejects.toMatchObject({
      code: 11000,
    })
  })

  test('widerrufene und verwendete Einladungen werden abgelehnt (Roundtrip)', async () => {
    const { tokenHash } = generateInviteToken()
    const invite = await createInvite(tokenHash)
    expect(validateInviteState(invite)).toEqual({ valid: true })

    invite.revokedAt = new Date()
    await invite.save()
    const revoked = await InviteToken.findOne({ tokenHash })
    expect(validateInviteState(revoked!)).toEqual({ valid: false, reason: 'revoked' })

    revoked!.revokedAt = undefined
    revoked!.used = true
    await revoked!.save()
    const used = await InviteToken.findOne({ tokenHash })
    expect(validateInviteState(used!)).toEqual({ valid: false, reason: 'used' })
  })
})
