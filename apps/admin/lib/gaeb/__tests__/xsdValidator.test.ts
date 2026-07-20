import { describe, it, expect } from 'vitest'
import { validateAgainstXsd, isXsdEngineAvailable } from '@/lib/gaeb/validator/xsdValidator'

describe('validateAgainstXsd', () => {
  it('meldet available=false ohne XSD-Pfad', async () => {
    const r = await validateAgainstXsd('<root/>')
    expect(r.available).toBe(false)
  })

  it('lehnt Path-Traversal ab', async () => {
    const r = await validateAgainstXsd('<root/>', '../../../etc/passwd')
    expect(r.available).toBe(false)
  })

  it('validiert gegen ein XSD-Schema (wenn Engine verfügbar)', async () => {
    if (!isXsdEngineAvailable()) return // ohne libxmljs2 überspringen (Fallback)

    const ok = await validateAgainstXsd('<root><a>hi</a></root>', '__test__/minimal.xsd')
    expect(ok.available).toBe(true)
    expect(ok.errors?.length ?? 0).toBe(0)

    const bad = await validateAgainstXsd('<root><b>x</b></root>', '__test__/minimal.xsd')
    expect(bad.available).toBe(true)
    expect(bad.errors?.length ?? 0).toBeGreaterThan(0)
  })
})
