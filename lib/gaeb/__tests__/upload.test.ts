import { describe, it, expect } from 'vitest'
import { validateGaebUpload, getFileExtension } from '@/lib/gaeb/upload'

const MAX = 25 * 1024 * 1024

describe('getFileExtension', () => {
  it('liefert Kleinschreibung ohne Punkt', () => {
    expect(getFileExtension('LV.X83')).toBe('x83')
    expect(getFileExtension('datei.ohne')).toBe('ohne')
    expect(getFileExtension('keinepunkte')).toBe('')
  })
})

describe('validateGaebUpload', () => {
  it('akzeptiert gültige GAEB-Endungen', () => {
    expect(validateGaebUpload({ name: 'lv.x83', sizeBytes: 1000, maxFileSizeBytes: MAX }).ok).toBe(true)
    expect(validateGaebUpload({ name: 'angebot.xml', sizeBytes: 1000, maxFileSizeBytes: MAX }).ok).toBe(true)
    expect(validateGaebUpload({ name: 'auftrag.d86', sizeBytes: 1000, maxFileSizeBytes: MAX }).ok).toBe(true)
  })

  it('lehnt unzulässige Endungen ab', () => {
    const res = validateGaebUpload({ name: 'schad.exe', sizeBytes: 1000, maxFileSizeBytes: MAX })
    expect(res.ok).toBe(false)
    expect(res.error).toContain('Unzulässige Dateiendung')
  })

  it('lehnt zu große Dateien ab', () => {
    const res = validateGaebUpload({ name: 'lv.x83', sizeBytes: MAX + 1, maxFileSizeBytes: MAX })
    expect(res.ok).toBe(false)
    expect(res.error).toContain('zu groß')
  })

  it('lehnt leere Dateien und fehlenden Namen ab', () => {
    expect(validateGaebUpload({ name: 'lv.x83', sizeBytes: 0, maxFileSizeBytes: MAX }).ok).toBe(false)
    expect(validateGaebUpload({ name: '', sizeBytes: 100, maxFileSizeBytes: MAX }).ok).toBe(false)
  })
})
