import { describe, it, expect } from 'vitest'
import { parseSecureXml } from '@/lib/gaeb/xml/secureXml'
import { validateGaebStructure } from '@/lib/gaeb/validator/structuralValidator'
import { parseGaeb } from '@/lib/gaeb/parser/parseGaeb'

const SAMPLE_GAEB = `<?xml version="1.0" encoding="UTF-8"?>
<GAEB xmlns="http://www.gaeb.de/GAEB_DA_XML/DA83/3.2">
  <GAEBInfo><Version>3.2</Version></GAEBInfo>
  <PrjInfo><NamePrj>Testprojekt A40</NamePrj></PrjInfo>
  <Award>
    <DP>83</DP>
    <BoQ>
      <BoQInfo><Name>Test-LV</Name><Cur>EUR</Cur></BoQInfo>
      <BoQBody>
        <BoQCtgy RNoPart="01">
          <LblTx>Verkehrssicherung</LblTx>
          <BoQBody>
            <Itemlist>
              <Item RNoPart="0010">
                <Qty>100</Qty><QU>m</QU><UP>3.50</UP><IT>350.00</IT>
                <Description><CompleteText>
                  <OutlineText><OutlTxt><TextOutlTxt>Absperrschranke</TextOutlTxt></OutlTxt></OutlineText>
                  <DetailTxt><Text>Absperrschranke reflektierend RA2</Text></DetailTxt>
                </CompleteText></Description>
              </Item>
              <Item RNoPart="0020">
                <Qty>40</Qty><QU>St</QU><UP>18.00</UP><IT>720.00</IT>
                <Description><CompleteText>
                  <OutlineText><OutlTxt><TextOutlTxt>Verkehrszeichen</TextOutlTxt></OutlTxt></OutlineText>
                </CompleteText></Description>
              </Item>
            </Itemlist>
          </BoQBody>
        </BoQCtgy>
      </BoQBody>
    </BoQ>
  </Award>
</GAEB>`

describe('parseSecureXml (Security)', () => {
  it('parst gültiges GAEB-XML', () => {
    const res = parseSecureXml(SAMPLE_GAEB)
    expect(res.ok).toBe(true)
    expect(res.data).toBeTruthy()
  })

  it('lehnt DOCTYPE/ENTITY (XXE) ab', () => {
    const xxe = `<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY x "y">]><GAEB/>`
    const res = parseSecureXml(xxe)
    expect(res.ok).toBe(false)
    expect(res.error).toContain('DOCTYPE')
  })

  it('lehnt leere Eingabe ab', () => {
    expect(parseSecureXml('').ok).toBe(false)
  })
})

describe('validateGaebStructure', () => {
  it('erkennt Version und Phase aus der Datei', () => {
    const parsed = parseSecureXml(SAMPLE_GAEB).data
    const result = validateGaebStructure(parsed)
    expect(result.valid).toBe(true)
    expect(result.detectedVersion).toBe('3.2')
    expect(result.detectedPhase).toBe('X83')
  })

  it('meldet Fehler bei fehlendem GAEB-Wurzelelement', () => {
    const parsed = parseSecureXml('<Root><X/></Root>').data
    const result = validateGaebStructure(parsed)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.code === 'GAEB_ROOT_MISSING')).toBe(true)
  })
})

describe('parseGaeb', () => {
  it('extrahiert Lose, Titel und Positionen', () => {
    const parsed = parseSecureXml(SAMPLE_GAEB).data
    const boq = parseGaeb({ parsed, importJobId: 'job1', version: '3.2', phase: 'X83' })

    expect(boq.projectName).toBe('Testprojekt A40')
    expect(boq.currency).toBe('EUR')
    expect(boq.positionCount).toBe(2)
    expect(boq.lots.length).toBe(1)
    expect(boq.lots[0].label).toBe('Verkehrssicherung')

    const positions = boq.lots[0].titles.flatMap((t) => t.positions)
    expect(positions.length).toBe(2)

    const first = positions.find((p) => p.ordinalNumber === '0010')
    expect(first?.shortText).toContain('Absperrschranke')
    expect(first?.quantity).toBe(100)
    expect(first?.unit).toBe('m')
    expect(first?.price?.unitPrice).toBe(3.5)
    expect(first?.price?.totalPrice).toBe(350)

    // Nettosumme = Summe der Positions-Gesamtpreise
    expect(boq.netSum).toBe(1070)
  })

  it('ist robust bei fehlenden Feldern', () => {
    const minimal = parseSecureXml(
      '<GAEB><Award><DP>81</DP><BoQ><BoQBody><Itemlist><Item RNoPart="1"><Qty>5</Qty></Item></Itemlist></BoQBody></BoQ></Award></GAEB>'
    ).data
    const boq = parseGaeb({ parsed: minimal, importJobId: 'j', version: '3.2', phase: 'X81' })
    expect(boq.positionCount).toBe(1)
    expect(boq.lots[0].titles[0].positions[0].quantity).toBe(5)
  })
})
