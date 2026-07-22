import { describe, expect, test } from 'vitest'
import { bankRowFingerprint, parseBankCsv } from './bankCsv'

describe('Bank-CSV', () => {
  test('liest deutsches Semikolonformat und Vorzeichen', () => {
    const rows = parseBankCsv('Buchungstag;Betrag;Verwendungszweck;Auftraggeber\n15.05.2026;-123,45;Tanken;Tankstelle\n16.05.2026;500,00;Kunde;DB AG')
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ bookingDate: '2026-05-15', amountCents: -12345, reference: 'Tanken' })
    expect(rows[1].amountCents).toBe(50000)
  })

  test('erzeugt für identische Bankzeilen denselben Dubletten-Fingerprint', () => {
    const row = { bookingDate: '2026-05-15', amountCents: -12345, reference: 'Miete Mai', counterparty: 'Vermieter' }
    expect(bankRowFingerprint(row)).toBe(bankRowFingerprint({ ...row }))
    expect(bankRowFingerprint(row)).not.toBe(bankRowFingerprint({ ...row, amountCents: -12346 }))
  })
})
