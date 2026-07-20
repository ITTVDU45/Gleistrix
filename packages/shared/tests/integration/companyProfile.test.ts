import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import mongoose from 'mongoose'
import { connectTestDb, disconnectTestDb, clearCollections } from './helpers/db'
import CompanyProfile from '@/lib/models/CompanyProfile'
import { getCompanyProfile, envCompanyName } from '@/lib/company/companyProfile'
import { getEmailBranding } from '@/lib/mailer'

// 1x1 transparentes PNG
const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

beforeAll(async () => {
  await connectTestDb()
  // dbConnect nutzt einen eigenen globalen Cache – mit der Test-Verbindung primen
  ;(globalThis as unknown as { mongooseCache: unknown }).mongooseCache = {
    conn: mongoose,
    promise: Promise.resolve(mongoose),
  }
})

afterAll(async () => {
  await disconnectTestDb()
})

beforeEach(async () => {
  await clearCollections()
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('envCompanyName', () => {
  test('entfernt umschließende Anführungszeichen aus ENV', () => {
    vi.stubEnv('EMAIL_COMPANY_NAME', '"Muelheimer Wachdienst Zeiterfassung"')
    expect(envCompanyName()).toBe('Muelheimer Wachdienst Zeiterfassung')
  })

  test('Fallback ohne ENV', () => {
    vi.stubEnv('EMAIL_COMPANY_NAME', '')
    vi.stubEnv('COMPANY_NAME', '')
    vi.stubEnv('EMAIL_FROM_NAME', '')
    expect(envCompanyName()).toBe('Mülheimer Wachdienst GmbH')
  })
})

describe('getCompanyProfile', () => {
  test('ohne DB-Profil → ENV-Firmenname', async () => {
    vi.stubEnv('EMAIL_COMPANY_NAME', 'Env Firma GmbH')
    const profile = await getCompanyProfile()
    expect(profile.companyName).toBe('Env Firma GmbH')
    expect(profile.logoBase64).toBeUndefined()
  })

  test('DB-Firmenname hat Vorrang vor ENV', async () => {
    vi.stubEnv('EMAIL_COMPANY_NAME', 'Env Firma GmbH')
    await CompanyProfile.create({ scope: 'global', companyName: 'DB Firma GmbH' })
    const profile = await getCompanyProfile()
    expect(profile.companyName).toBe('DB Firma GmbH')
  })
})

describe('getEmailBranding', () => {
  test('nutzt Firmenname und Logo aus dem Profil (Base64 → CID-Attachment)', async () => {
    await CompanyProfile.create({
      scope: 'global',
      companyName: 'Mülheimer Wachdienst GmbH',
      logoBase64: PNG_BASE64,
      logoContentType: 'image/png',
    })

    const branding = await getEmailBranding()

    expect(branding.companyName).toBe('Mülheimer Wachdienst GmbH')
    expect(branding.headerHtml).toContain('cid:company-logo')
    expect(branding.headerHtml).toContain('Mülheimer Wachdienst GmbH') // alt-Text
    expect(branding.attachment).toBeDefined()
    expect(branding.attachment?.cid).toBe('company-logo')
    expect(branding.attachment?.contentType).toBe('image/png')
    // Buffer entspricht dem dekodierten Base64
    expect(Buffer.isBuffer(branding.attachment?.content)).toBe(true)
    expect((branding.attachment?.content as Buffer).toString('base64')).toBe(PNG_BASE64)
  })

  test('Firmenname aus Profil auch ohne Logo im Header', async () => {
    await CompanyProfile.create({ scope: 'global', companyName: 'Nur Name GmbH' })
    const branding = await getEmailBranding()
    expect(branding.companyName).toBe('Nur Name GmbH')
    expect(branding.headerHtml).toContain('Nur Name GmbH')
  })
})
