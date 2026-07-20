import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { IReceivedInvoice } from '@/lib/models/ReceivedInvoice'
import { round2 } from '@/lib/subunternehmen/invoiceTotals'

const formatEuro = (value: number): string =>
  `${(value || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`

const formatDate = (value?: Date | string): string => {
  if (!value) return '–'
  const d = value instanceof Date ? value : new Date(value)
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString('de-DE')
}

export interface InvoicePdfCompany {
  name: string
  legalName?: string
  billingAddress?: { street?: string; postalCode?: string; city?: string; country?: string }
  contactEmail?: string
  contactPhone?: string
  taxNumber?: string
  vatId?: string
  iban?: string
  bic?: string
  bankName?: string
}

/** Rechnungsempfänger (interner Betrieb); per ENV übersteuerbar. */
function invoiceRecipientLines(): string[] {
  const name = process.env.INVOICE_RECIPIENT_NAME || 'Mülheimer Wachdienst GmbH'
  const street = process.env.INVOICE_RECIPIENT_STREET || ''
  const city = process.env.INVOICE_RECIPIENT_CITY || ''
  return [name, street, city].filter(Boolean)
}

/**
 * Erzeugt die unveränderbare Rechnungs-PDF beim Einreichen (serverseitig).
 * Rückgabe: PDF-Buffer für die Ablage in MinIO.
 */
export function createInvoicePdf(
  invoice: Pick<
    IReceivedInvoice,
    | 'invoiceNumber' | 'invoiceDate' | 'servicePeriodStart' | 'servicePeriodEnd'
    | 'lineItems' | 'subtotalNet' | 'totalVat' | 'totalGross'
    | 'paymentTermDays' | 'dueDate' | 'remarks' | 'orderNumber' | 'purchaseOrderNumber' | 'version'
  >,
  company: InvoicePdfCompany,
  projectLabels: string[]
): Buffer {
  const doc: any = new (jsPDF as any)({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 18

  // Kopf: Rechnungssteller (Subunternehmen)
  const issuerName = company.legalName || company.name
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text(issuerName, margin, 22)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  const issuerLines = [
    company.billingAddress?.street || '',
    [company.billingAddress?.postalCode, company.billingAddress?.city].filter(Boolean).join(' '),
    company.billingAddress?.country || '',
    company.contactEmail ? `E-Mail: ${company.contactEmail}` : '',
    company.contactPhone ? `Telefon: ${company.contactPhone}` : '',
  ].filter(Boolean)
  let y = 28
  for (const line of issuerLines) {
    doc.text(line, margin, y)
    y += 4.5
  }

  // Empfänger
  y = Math.max(y + 6, 52)
  doc.setFontSize(8)
  doc.setTextColor(120)
  doc.text(`${issuerName} · Rechnungsanschrift siehe oben`, margin, y - 4)
  doc.setTextColor(0)
  doc.setFontSize(11)
  let recipientY = y + 2
  for (const line of invoiceRecipientLines()) {
    doc.text(line, margin, recipientY)
    recipientY += 5.5
  }

  // Meta-Block rechts
  const metaX = pageWidth - margin - 70
  doc.setFontSize(10)
  const meta: Array<[string, string]> = [
    ['Rechnungsnummer:', invoice.invoiceNumber + (invoice.version > 1 ? ` (Rev. ${invoice.version})` : '')],
    ['Rechnungsdatum:', formatDate(invoice.invoiceDate)],
    ...(invoice.servicePeriodStart
      ? [['Leistungszeitraum:', `${formatDate(invoice.servicePeriodStart)} – ${formatDate(invoice.servicePeriodEnd)}`] as [string, string]]
      : []),
    ...(invoice.orderNumber ? [['Auftragsnummer:', invoice.orderNumber] as [string, string]] : []),
    ...(invoice.purchaseOrderNumber ? [['Bestellnummer:', invoice.purchaseOrderNumber] as [string, string]] : []),
    ...(projectLabels.length > 0 ? [['Projekte:', projectLabels.join(', ')] as [string, string]] : []),
  ]
  let metaY = y + 2
  for (const [label, value] of meta) {
    doc.setFont('helvetica', 'bold')
    doc.text(label, metaX, metaY)
    doc.setFont('helvetica', 'normal')
    const wrapped = doc.splitTextToSize(value, 68 - 32)
    doc.text(wrapped, metaX + 32, metaY)
    metaY += 5 * (Array.isArray(wrapped) ? wrapped.length : 1)
  }

  // Titel
  const titleY = Math.max(recipientY, metaY) + 10
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text(`Rechnung ${invoice.invoiceNumber}`, margin, titleY)
  doc.setFont('helvetica', 'normal')

  // Positionen
  const body = invoice.lineItems.map((li, idx) => [
    String(idx + 1),
    li.description + (li.serviceDate ? `\n${formatDate(li.serviceDate)}` : ''),
    `${(li.quantity || 0).toLocaleString('de-DE')} ${li.unit}`,
    formatEuro(li.unitPrice),
    `${li.vatRate} %`,
    formatEuro(li.netAmount),
  ])

  autoTable(doc, {
    startY: titleY + 5,
    head: [['Pos.', 'Beschreibung', 'Menge', 'Einzelpreis', 'USt.', 'Netto']],
    body,
    margin: { left: margin, right: margin },
    styles: { fontSize: 9, cellPadding: 2.2, valign: 'top' },
    headStyles: { fillColor: [29, 78, 216], textColor: 255, fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 12 },
      2: { cellWidth: 24, halign: 'right' },
      3: { cellWidth: 26, halign: 'right' },
      4: { cellWidth: 16, halign: 'right' },
      5: { cellWidth: 26, halign: 'right' },
    },
  })

  // Summen (nach USt-Satz gruppiert)
  const afterTable = (doc as any).lastAutoTable?.finalY || titleY + 40
  const vatByRate = new Map<number, number>()
  for (const li of invoice.lineItems) {
    vatByRate.set(li.vatRate, round2((vatByRate.get(li.vatRate) || 0) + (li.vatAmount || 0)))
  }
  const sumX = pageWidth - margin - 70
  let sumY = afterTable + 8
  const sumLine = (label: string, value: string, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setFontSize(bold ? 11 : 10)
    doc.text(label, sumX, sumY)
    doc.text(value, pageWidth - margin, sumY, { align: 'right' })
    sumY += bold ? 7 : 5.5
  }
  sumLine('Nettobetrag:', formatEuro(invoice.subtotalNet))
  for (const [rate, amount] of Array.from(vatByRate.entries()).sort((a, b) => a[0] - b[0])) {
    sumLine(`zzgl. ${rate} % USt.:`, formatEuro(amount))
  }
  doc.setDrawColor(29, 78, 216)
  doc.line(sumX, sumY - 2, pageWidth - margin, sumY - 2)
  sumLine('Rechnungsbetrag:', formatEuro(invoice.totalGross), true)

  // Zahlungsziel
  let footY = sumY + 6
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  if (invoice.dueDate) {
    doc.text(
      `Zahlbar ohne Abzug bis ${formatDate(invoice.dueDate)}${invoice.paymentTermDays ? ` (${invoice.paymentTermDays} Tage)` : ''}.`,
      margin,
      footY
    )
    footY += 5
  }
  if (invoice.remarks) {
    const remarkLines = doc.splitTextToSize(`Bemerkungen: ${invoice.remarks}`, pageWidth - 2 * margin)
    doc.text(remarkLines, margin, footY)
    footY += remarkLines.length * 4.5 + 2
  }

  // Fußzeile: Bankverbindung & Steuerangaben
  const pageHeight = doc.internal.pageSize.getHeight()
  const footerY = pageHeight - 24
  doc.setDrawColor(203, 213, 225)
  doc.line(margin, footerY - 4, pageWidth - margin, footerY - 4)
  doc.setFontSize(8)
  doc.setTextColor(90)
  const footerParts: string[] = []
  if (company.bankName || company.iban) {
    footerParts.push(
      `Bankverbindung: ${[company.bankName, company.iban ? `IBAN ${company.iban}` : '', company.bic ? `BIC ${company.bic}` : ''].filter(Boolean).join(' · ')}`
    )
  }
  if (company.taxNumber) footerParts.push(`Steuernummer: ${company.taxNumber}`)
  if (company.vatId) footerParts.push(`USt-IdNr.: ${company.vatId}`)
  footerParts.push('Erstellt über das Gleistrix Subunternehmen-Portal')
  let fy = footerY
  for (const part of footerParts) {
    doc.text(part, margin, fy)
    fy += 4
  }
  doc.setTextColor(0)

  return Buffer.from(doc.output('arraybuffer'))
}
