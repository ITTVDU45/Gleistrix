import { describe, expect, test } from 'vitest'
import { generateInviteToken, hashInviteToken, validateInviteState } from './inviteToken'

describe('generateInviteToken', () => {
  test('erzeugt Token und passenden SHA-256-Hash', () => {
    const { token, tokenHash } = generateInviteToken()
    expect(token.length).toBeGreaterThanOrEqual(32)
    expect(tokenHash).toBe(hashInviteToken(token))
    expect(tokenHash).toMatch(/^[a-f0-9]{64}$/)
  })

  test('Hash ist nicht als Token einlösbar (sha256(hash) ≠ hash)', () => {
    const { tokenHash } = generateInviteToken()
    expect(hashInviteToken(tokenHash)).not.toBe(tokenHash)
  })

  test('Tokens sind einmalig', () => {
    const a = generateInviteToken()
    const b = generateInviteToken()
    expect(a.token).not.toBe(b.token)
  })
})

describe('validateInviteState', () => {
  const now = new Date('2026-07-19T12:00:00Z')
  const future = new Date('2026-07-20T12:00:00Z')
  const past = new Date('2026-07-18T12:00:00Z')

  test('gültige Einladung wird akzeptiert', () => {
    expect(validateInviteState({ expiresAt: future }, now)).toEqual({ valid: true })
  })

  test('abgelaufene Einladung wird abgelehnt', () => {
    expect(validateInviteState({ expiresAt: past }, now)).toEqual({ valid: false, reason: 'expired' })
  })

  test('widerrufene Einladung wird abgelehnt', () => {
    expect(validateInviteState({ expiresAt: future, revokedAt: past }, now)).toEqual({
      valid: false,
      reason: 'revoked',
    })
  })

  test('bereits genutzte Einladung wird abgelehnt (nur einmal verwendbar)', () => {
    expect(validateInviteState({ expiresAt: future, used: true }, now)).toEqual({
      valid: false,
      reason: 'used',
    })
  })
})
