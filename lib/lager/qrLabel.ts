/**
 * Einheitliche Beschriftung unter QR-Codes für Lagerartikel.
 * Wird von Frontend (ArticleDetailsDialog), PNG-Download, Print und PDF genutzt.
 *
 * Zeile 1: Kategorie, Unterkategorie, Artikelnummer
 * Zeile 2 (optional): Seriennummer
 */

export interface QrLabelInput {
  kategorie?: string
  unterkategorie?: string
  artikelnummer?: string
  seriennummer?: string
}

export interface QrLabelLines {
  line1: string
  line2: string | null
}

export function buildQrLabel(input: QrLabelInput): QrLabelLines {
  const parts: string[] = []
  const kat = (input.kategorie ?? '').trim()
  const sub = (input.unterkategorie ?? '').trim()
  const nr = (input.artikelnummer ?? '').trim()

  if (kat) parts.push(kat)
  if (sub) parts.push(sub)
  if (nr) parts.push(nr)

  const line1 = parts.length > 0 ? parts.join(' · ') : '-'
  const sn = (input.seriennummer ?? '').trim()
  const line2 = sn ? `SN: ${sn}` : null

  return { line1, line2 }
}
