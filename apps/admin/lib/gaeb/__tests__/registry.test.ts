import { describe, it, expect } from 'vitest'
import {
  mergeGaebSettings,
  getGaebVersion,
  getPhaseDefinition,
  DEFAULT_GAEB_SETTINGS,
} from '@/lib/gaeb/registry'

describe('mergeGaebSettings', () => {
  it('nutzt Defaults bei fehlender Konfiguration', () => {
    const s = mergeGaebSettings(null)
    expect(s.enabled).toBe(DEFAULT_GAEB_SETTINGS.enabled)
    expect(s.allowedVersions.length).toBeGreaterThan(0)
  })

  it('filtert unbekannte Versionen und Phasen gegen die Registry', () => {
    const s = mergeGaebSettings({
      enabled: true,
      scope: 'global',
      allowedVersions: ['3.3', '9.9'],
      allowedPhases: ['X81', 'X99'],
      maxFileSizeBytes: 1000,
      strictXsdValidation: false,
    })
    expect(s.allowedVersions).toContain('3.3')
    expect(s.allowedVersions).not.toContain('9.9')
    expect(s.allowedPhases).toContain('X81')
    expect(s.allowedPhases).not.toContain('X99')
    expect(s.enabled).toBe(true)
  })
})

describe('Registry-Zugriff', () => {
  it('findet Version und Phasen-Definition', () => {
    expect(getGaebVersion('3.3')?.format).toBe('gaeb-da-xml')
    expect(getGaebVersion('unbekannt')).toBeUndefined()
    const phase = getPhaseDefinition('3.3', 'X81')
    expect(phase?.direction).toBe('import')
    expect(phase?.hasPrices).toBe(false)
  })
})
