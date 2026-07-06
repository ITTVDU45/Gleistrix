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

const LABEL_WIDTH = 90
const LABEL_HEIGHT = 28
const COLS = 2
const ROWS = 10
const MARGIN = 15
const FONT_SIZE = 8

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str
  return str.slice(0, maxLen - 2) + '…'
}

export async function createBarcodeLabelsPDF(articles: LabelArticle[]): Promise<Buffer> {
  const pdf: any = new (jsPDF as any)({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  let labelIndex = 0

  for (const art of articles) {
    if (labelIndex > 0 && labelIndex % (COLS * ROWS) === 0) {
      pdf.addPage()
    }
    const col = labelIndex % COLS
    const row = Math.floor((labelIndex % (COLS * ROWS)) / COLS)
    const x = MARGIN + col * LABEL_WIDTH
    const y = MARGIN + row * LABEL_HEIGHT

    const label = buildQrLabel({
      kategorie: art.kategorie,
      unterkategorie: art.unterkategorie,
      artikelnummer: art.artikelnummer,
      seriennummer: art.seriennummer,
    })

    pdf.setFontSize(FONT_SIZE)
    pdf.setFont('helvetica', 'bold')
    pdf.text(truncate(label.line1, 30), x, y + 5)
    if (label.line2) {
      pdf.setFont('helvetica', 'normal')
      pdf.text(truncate(label.line2, 30), x, y + 11)
    }
    pdf.setFontSize(FONT_SIZE - 1)
    pdf.setFont('helvetica', 'normal')
    pdf.text(truncate(art.barcode || art.artikelnummer, 28), x, y + (label.line2 ? 17 : 11))

    labelIndex++
  }

  const buf = Buffer.from(pdf.output('arraybuffer'))
  return buf
}
