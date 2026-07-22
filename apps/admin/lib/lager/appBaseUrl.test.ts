import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { appBaseUrl } from './appBaseUrl'

const URL_ENV_KEYS = ['APP_DOMAIN', 'NEXTAUTH_URL', 'NEXT_PUBLIC_BASE_URL'] as const

function clearUrlEnv(): void {
  for (const key of URL_ENV_KEYS) delete process.env[key]
}

describe('appBaseUrl', () => {
  beforeEach(clearUrlEnv)
  afterEach(clearUrlEnv)

  it('bevorzugt die Runtime-Variable APP_DOMAIN vor NEXT_PUBLIC_BASE_URL', () => {
    // NEXT_PUBLIC_BASE_URL wird zur Build-Zeit eingebrannt; die zur Laufzeit
    // gelesene APP_DOMAIN muss gewinnen, damit ein Domainwechsel ohne Rebuild wirkt.
    process.env.APP_DOMAIN = 'https://zeit.mulheimer-wachdienst.de'
    process.env.NEXT_PUBLIC_BASE_URL = 'https://zeit.muelheimer-wachdienst.de'

    expect(appBaseUrl()).toBe('https://zeit.mulheimer-wachdienst.de')
  })

  it('nutzt NEXTAUTH_URL, wenn APP_DOMAIN fehlt', () => {
    process.env.NEXTAUTH_URL = 'https://zeit.mulheimer-wachdienst.de'
    process.env.NEXT_PUBLIC_BASE_URL = 'https://zeit.muelheimer-wachdienst.de'

    expect(appBaseUrl()).toBe('https://zeit.mulheimer-wachdienst.de')
  })

  it('fällt auf NEXT_PUBLIC_BASE_URL zurück und entfernt abschließende Slashes', () => {
    process.env.NEXT_PUBLIC_BASE_URL = 'https://zeit.mulheimer-wachdienst.de///'

    expect(appBaseUrl()).toBe('https://zeit.mulheimer-wachdienst.de')
  })

  it('liefert einen leeren String, wenn keine URL-Variable gesetzt ist', () => {
    expect(appBaseUrl()).toBe('')
  })
})
