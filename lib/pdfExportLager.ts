import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export type DeliveryNoteDoc = {
  nummer: string
  datum: Date | string
  typ: string
  empfaenger?: { name?: string; adresse?: string }
  positionen?: Array<{
    artikelId?: { bezeichnung?: string; artikelnummer?: string } | unknown
    bezeichnung?: string
    menge?: number
    seriennummer?: string
  }>
}

export type InventoryDoc = {
  typ: string
  stichtag: Date | string
  status: string
  abgeschlossenAm?: Date | string | null
  positionen?: Array<{
    artikelId?: { bezeichnung?: string; artikelnummer?: string } | unknown
    sollMenge?: number
    istMenge?: number
    differenz?: number
  }>
}

function formatDate(d: Date | string): string {
  try {
    const date = typeof d === 'string' ? new Date(d) : d
    const dd = String(date.getDate()).padStart(2, '0')
    const mm = String(date.getMonth() + 1).padStart(2, '0')
    const yyyy = date.getFullYear()
    return `${dd}.${mm}.${yyyy}`
  } catch {
    return String(d ?? '-')
  }
}

function addDeliverySignatureSection(pdf: any, startY: number, typ: string, margin: number) {
  const pageSize = pdf?.internal?.pageSize
  const pageWidth = typeof pageSize?.getWidth === 'function' ? pageSize.getWidth() : Number(pageSize?.width ?? 210)
  const pageHeight = typeof pageSize?.getHeight === 'function' ? pageSize.getHeight() : Number(pageSize?.height ?? 297)
  const colGap = 12
  const colWidth = (pageWidth - margin * 2 - colGap) / 2
  const counterpartLabel = typ === 'eingang' ? 'Lieferant' : 'Empfaenger'

  let y = startY
  if (y > pageHeight - 55) {
    pdf.addPage()
    y = 28
  }

  const leftX = margin
  const rightX = margin + colWidth + colGap

  pdf.setFontSize(10)
  pdf.setFont('helvetica', 'bold')
  pdf.text('Unterschrift Herausgeber', leftX, y)
  pdf.text(`Unterschrift ${counterpartLabel}`, rightX, y)

  pdf.setFont('helvetica', 'normal')
  pdf.line(leftX, y + 14, leftX + colWidth, y + 14)
  pdf.line(rightX, y + 14, rightX + colWidth, y + 14)
  pdf.text('Datum: ____________________', leftX, y + 22)
  pdf.text('Datum: ____________________', rightX, y + 22)
}


export async function createDeliveryNotePDF(doc: DeliveryNoteDoc): Promise<Buffer> {
  const pdf: any = new (jsPDF as any)({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const margin = 20
  let y = 20

  try {
    const { readFileSync, existsSync } = await import('fs')
    const { join } = await import('path')
    const logoPath = join(process.cwd(), 'public', 'mwd-logo.png')
    if (existsSync(logoPath)) {
      const img = readFileSync(logoPath)
      const base64 = `data:image/png;base64,${img.toString('base64')}`
      pdf.addImage(base64, 'PNG', margin, y, 60, 30)
    }
  } catch {
    // ignore
  }
  y += 38

  pdf.setFontSize(18)
  pdf.text('Lieferschein', margin, y)
  y += 10

  pdf.setFontSize(10)
  pdf.text(`Nr. ${doc.nummer ?? '-'}`, margin, y)
  y += 6
  pdf.text(`Datum: ${formatDate(doc.datum ?? '')}`, margin, y)
  y += 6
  pdf.text(`Typ: ${doc.typ === 'ausgang' ? 'Ausgang' : 'Eingang'}`, margin, y)
  y += 6
  const empName = doc.empfaenger?.name ?? '-'
  pdf.text(`Empfaenger: ${empName}`, margin, y)
  if (doc.empfaenger?.adresse) {
    y += 6
    pdf.text(`Adresse: ${doc.empfaenger.adresse}`, margin, y)
  }
  y += 14

  const positionen = doc.positionen ?? []
  const rows = positionen.map((p) => {
    const art = p.artikelId as { bezeichnung?: string; artikelnummer?: string } | undefined
    const bezeichnung = p.bezeichnung ?? art?.bezeichnung ?? '-'
    const artikelnummer = art?.artikelnummer ?? '-'
    const menge = p.menge ?? 0
    const seriennummer = p.seriennummer ?? ''
    return [bezeichnung, artikelnummer, String(menge), seriennummer]
  })

  if (rows.length > 0) {
    autoTable(pdf, {
      startY: y,
      head: [['Bezeichnung', 'Artikelnummer', 'Menge', 'Seriennummer']],
      body: rows,
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 4 },
      headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      margin: { left: margin, right: margin }
    })
  }

  const tableEndY = (pdf as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY
  const signatureStartY = (typeof tableEndY === 'number' ? tableEndY : y) + 14
  addDeliverySignatureSection(pdf, signatureStartY, doc.typ, margin)

  const buf = Buffer.from(pdf.output('arraybuffer'))
  return buf
}

export async function createInventoryProtocolPDF(inv: InventoryDoc): Promise<Buffer> {
  const pdf: any = new (jsPDF as any)({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const margin = 20
  let y = 20

  try {
    const { readFileSync, existsSync } = await import('fs')
    const { join } = await import('path')
    const logoPath = join(process.cwd(), 'public', 'mwd-logo.png')
    if (existsSync(logoPath)) {
      const img = readFileSync(logoPath)
      const base64 = `data:image/png;base64,${img.toString('base64')}`
      pdf.addImage(base64, 'PNG', margin, y, 60, 30)
    }
  } catch {
    // ignore
  }
  y += 38

  pdf.setFontSize(18)
  pdf.text('Inventurprotokoll', margin, y)
  y += 10

  pdf.setFontSize(10)
  pdf.text(`Stichtag: ${formatDate(inv.stichtag ?? '')}`, margin, y)
  y += 6
  pdf.text(`Typ: ${inv.typ === 'voll' ? 'Vollinventur' : 'Teilinventur'}`, margin, y)
  y += 6
  if (inv.abgeschlossenAm) {
    pdf.text(`Abgeschlossen am: ${formatDate(inv.abgeschlossenAm)}`, margin, y)
    y += 6
  }
  y += 10

  const positionen = inv.positionen ?? []
  const rows = positionen.map((p) => {
    const art = p.artikelId as { bezeichnung?: string; artikelnummer?: string } | undefined
    const bezeichnung = art?.bezeichnung ?? '-'
    const artikelnummer = art?.artikelnummer ?? '-'
    const soll = p.sollMenge ?? 0
    const ist = p.istMenge ?? 0
    const diff = p.differenz ?? 0
    return [bezeichnung, artikelnummer, String(soll), String(ist), String(diff)]
  })

  if (rows.length > 0) {
    autoTable(pdf, {
      startY: y,
      head: [['Artikel', 'Artikelnummer', 'Soll', 'Ist', 'Differenz']],
      body: rows,
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 4 },
      headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      margin: { left: margin, right: margin }
    })
  }

  const buf = Buffer.from(pdf.output('arraybuffer'))
  return buf
}

export type MaintenanceReportEntry = {
  artikelId?: { bezeichnung?: string; artikelnummer?: string } | unknown
  wartungsart: string
  faelligkeitsdatum: Date | string
  durchfuehrungsdatum?: Date | string | null
  status: string
  ergebnis?: string
}

export async function createMaintenanceReportPDF(entries: MaintenanceReportEntry[]): Promise<Buffer> {
  const pdf: any = new (jsPDF as any)({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const margin = 20
  let y = 20

  try {
    const { readFileSync, existsSync } = await import('fs')
    const { join } = await import('path')
    const logoPath = join(process.cwd(), 'public', 'mwd-logo.png')
    if (existsSync(logoPath)) {
      const img = readFileSync(logoPath)
      const base64 = `data:image/png;base64,${img.toString('base64')}`
      pdf.addImage(base64, 'PNG', margin, y, 60, 30)
    }
  } catch {
    // ignore
  }
  y += 38

  pdf.setFontSize(18)
  pdf.text('Wartungsbericht', margin, y)
  y += 10
  pdf.setFontSize(10)
  pdf.text(`Exportiert am: ${new Date().toLocaleString('de-DE')}`, margin, y)
  y += 14

  const rows = entries.map((e) => {
    const art = e.artikelId as { bezeichnung?: string; artikelnummer?: string } | undefined
    const artikel = art?.bezeichnung ?? art?.artikelnummer ?? 'ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Å“'
    const faellig = formatDate(e.faelligkeitsdatum ?? '')
    const durchf = e.durchfuehrungsdatum ? formatDate(e.durchfuehrungsdatum) : 'ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Å“'
    const status = e.status ?? 'ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Å“'
    const ergebnis = (e.ergebnis ?? '').slice(0, 30)
    return [artikel, e.wartungsart ?? 'ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Å“', faellig, durchf, status, ergebnis]
  })

  if (rows.length > 0) {
    autoTable(pdf, {
      startY: y,
      head: [['Artikel', 'Wartungsart', 'FÃƒÆ’Ã‚Â¤llig am', 'DurchgefÃƒÆ’Ã‚Â¼hrt am', 'Status', 'Ergebnis']],
      body: rows,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      margin: { left: margin, right: margin }
    })
  }

  const buf = Buffer.from(pdf.output('arraybuffer'))
  return buf
}
