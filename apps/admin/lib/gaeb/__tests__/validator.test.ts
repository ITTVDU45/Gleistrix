import { describe, it, expect } from 'vitest'
import { validateGaeb } from '@/lib/gaeb/validator'
import { validateGaebStructure } from '@/lib/gaeb/validator/structuralValidator'
import { parseSecureXml } from '@/lib/gaeb/xml/secureXml'

const VALID = `<?xml version="1.0" encoding="UTF-8"?>
<GAEB><GAEBInfo><Version>3.3</Version></GAEBInfo><Award><DP>81</DP>
<BoQ><BoQBody><Itemlist><Item RNoPart="1"><Qty>1</Qty></Item></Itemlist></BoQBody></BoQ></Award></GAEB>`

describe('validateGaeb (Orchestrator)', () => {
  it('validiert gültige Struktur ohne XSD', async () => {
    const res = await validateGaeb(VALID, { strictXsd: false })
    expect(res.validation.valid).toBe(true)
    expect(res.validation.detectedVersion).toBe('3.3')
    expect(res.validation.detectedPhase).toBe('X81')
    expect(res.xsdUsed).toBe(false)
    expect(res.parsed).toBeTruthy()
  })

  it('meldet Parsefehler bei kaputtem XML', async () => {
    const res = await validateGaeb('<GAEB><nichtgeschlossen>', { strictXsd: false })
    expect(res.validation.valid).toBe(false)
    expect(res.validation.errors.length).toBeGreaterThan(0)
  })
})

describe('validateGaebStructure – Phasen-Erkennung', () => {
  it('übernimmt bereits X-präfigierte DP unverändert', () => {
    const parsed = parseSecureXml(
      '<GAEB><Award><DP>X84</DP><BoQ><BoQBody/></BoQ></Award></GAEB>'
    ).data
    const result = validateGaebStructure(parsed)
    expect(result.detectedPhase).toBe('X84')
  })

  it('meldet fehlendes Award-Element', () => {
    const parsed = parseSecureXml('<GAEB><GAEBInfo><Version>3.3</Version></GAEBInfo></GAEB>').data
    const result = validateGaebStructure(parsed)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.code === 'AWARD_MISSING')).toBe(true)
  })
})

describe('secureXml – Security', () => {
  it('lehnt DOCTYPE auch nach führendem Kommentar ab', () => {
    const withComment = `<?xml version="1.0"?>\n<!-- ${'x'.repeat(500)} -->\n<!DOCTYPE foo><GAEB/>`
    const res = parseSecureXml(withComment)
    expect(res.ok).toBe(false)
    expect(res.error).toContain('DOCTYPE')
  })
})
