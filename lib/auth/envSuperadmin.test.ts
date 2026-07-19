import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import {
  ENV_SUPERADMIN_JWT_ID,
  isEnvSuperadminJwtToken,
  matchEnvSuperadminCredentials,
  envSuperadminDisplayName,
} from './envSuperadmin'

describe('isEnvSuperadminJwtToken', () => {
  test('true nur bei passender ID und Rolle', () => {
    expect(isEnvSuperadminJwtToken({ id: ENV_SUPERADMIN_JWT_ID, role: 'superadmin' })).toBe(true)
  })

  test('false bei abweichender Rolle', () => {
    expect(isEnvSuperadminJwtToken({ id: ENV_SUPERADMIN_JWT_ID, role: 'admin' })).toBe(false)
  })

  test('false bei normaler Benutzer-ID', () => {
    expect(isEnvSuperadminJwtToken({ id: '507f1f77bcf86cd799439011', role: 'superadmin' })).toBe(false)
  })

  test('false bei leerem Token', () => {
    expect(isEnvSuperadminJwtToken({})).toBe(false)
  })
})

describe('matchEnvSuperadminCredentials', () => {
  const original = {
    email: process.env.SUPERADMIN_EMAIL,
    password: process.env.SUPERADMIN_PASSWORD,
  }

  beforeEach(() => {
    process.env.SUPERADMIN_EMAIL = 'boss@example.com'
    process.env.SUPERADMIN_PASSWORD = 'super-geheim'
  })

  afterEach(() => {
    process.env.SUPERADMIN_EMAIL = original.email
    process.env.SUPERADMIN_PASSWORD = original.password
  })

  test('true bei korrekten Credentials (E-Mail case-insensitiv)', () => {
    expect(matchEnvSuperadminCredentials('BOSS@example.com', 'super-geheim')).toBe(true)
  })

  test('false bei falschem Passwort', () => {
    expect(matchEnvSuperadminCredentials('boss@example.com', 'falsch')).toBe(false)
  })

  test('false bei falscher E-Mail', () => {
    expect(matchEnvSuperadminCredentials('someone@example.com', 'super-geheim')).toBe(false)
  })

  test('false wenn ENV nicht konfiguriert ist', () => {
    delete process.env.SUPERADMIN_EMAIL
    delete process.env.SUPERADMIN_PASSWORD
    expect(matchEnvSuperadminCredentials('boss@example.com', 'super-geheim')).toBe(false)
  })
})

describe('envSuperadminDisplayName', () => {
  test('Fallback wenn kein Name gesetzt', () => {
    const original = process.env.SUPERADMIN_NAME
    delete process.env.SUPERADMIN_NAME
    expect(envSuperadminDisplayName()).toBe('Super Admin')
    process.env.SUPERADMIN_NAME = original
  })
})
