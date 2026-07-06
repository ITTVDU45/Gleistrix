import jsPDF from 'jspdf'
import { buildQrLabel } from '@/lib/lager/qrLabel'

export type LabelArticle = {
  artikelnummer: string
  bezeichnung: string
  barcode: string
  kategorie?: string
  unterkategorie?: string
  seriennummer?: string
}

const LABEL_W = 50.8
const LABEL_H = 25.4
const QR_SIZE = 19
const QR_MARGIN = 3.2
const TEXT_X = QR_MARGIN + QR_SIZE + 3
const TEXT_MAX_W = LABEL_W - TEXT_X - 2

const COLS = 3
const ROWS = 10
const PAGE_MARGIN_X = (210 - COLS * LABEL_W) / 2
const PAGE_MARGIN_Y = (297 - ROWS * LABEL_H) / 2

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str
  return str.slice(0, maxLen - 1) + '…'
}

export async function createBarcodeLabelsPDF(articles: LabelArticle[]): Promise<Buffer> {
  const QRCode = await import('qrcode')
  const pdf: any = new (jsPDF as any)({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  let labelIndex = 0

  for (const art of articles) {
    if (labelIndex > 0 && labelIndex % (COLS * ROWS) === 0) {
      pdf.addPage()
    }
    const col = labelIndex % COLS
    const row = Math.floor((labelIndex % (COLS * ROWS)) / COLS)
    const x = PAGE_MARGIN_X + col * LABEL_W
    const y = PAGE_MARGIN_Y + row * LABEL_H

    const label = buildQrLabel({
      kategorie: art.kategorie,
      unterkategorie: art.unterkategorie,
      artikelnummer: art.artikelnummer,
      seriennummer: art.seriennummer,
    })

    const qrDataUrl = await QRCode.toDataURL(art.barcode || art.artikelnummer, {
      width: 200,
      margin: 1,
      errorCorrectionLevel: 'M',
    })
    pdf.addImage(qrDataUrl, 'PNG', x + QR_MARGIN, y + QR_MARGIN, QR_SIZE, QR_SIZE)

    const maxChars = Math.floor(TEXT_MAX_W / 1.8)

    pdf.setFontSize(7)
    pdf.setFont('helvetica', 'bold')
    pdf.text(truncate(label.line1, maxChars), x + TEXT_X, y + 9)

    if (label.line2) {
      pdf.setFontSize(6.5)
      pdf.setFont('helvetica', 'normal')
      pdf.text(truncate(label.line2, maxChars), x + TEXT_X, y + 13.5)
    }

    pdf.setFontSize(5.5)
    pdf.setFont('helvetica', 'normal')
    pdf.setTextColor(100)
    pdf.text(truncate(art.barcode || art.artikelnummer, maxChars), x + TEXT_X, y + (label.line2 ? 17.5 : 13.5))
    pdf.setTextColor(0)

    labelIndex++
  }

  const buf = Buffer.from(pdf.output('arraybuffer'))
  return buf
}
