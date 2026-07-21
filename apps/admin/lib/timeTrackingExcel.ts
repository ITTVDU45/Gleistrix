import ExcelJS from 'exceljs'
import {
  TIME_TRACKING_EXPORT_HEADERS,
  type TimeTrackingExportRow,
} from './timeTrackingExport'

const COLUMN_WIDTHS = [12, 24, 20, 22, 18, 32, 15, 10, 16, 18, 18, 14, 12, 16]

export const TIME_TRACKING_EXCEL_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

export const createTimeTrackingExcelBuffer = async (
  rows: readonly TimeTrackingExportRow[]
): Promise<ArrayBuffer> => {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Gleistrix'
  workbook.title = 'Zeiterfassung'
  workbook.subject = 'Gefilterte Zeiteinträge'
  workbook.created = new Date()

  const worksheet = workbook.addWorksheet('Zeiterfassung', {
    views: [{ state: 'frozen', ySplit: 1 }],
  })
  worksheet.columns = COLUMN_WIDTHS.map((width) => ({ width }))

  const headerRow = worksheet.addRow(Array.from(TIME_TRACKING_EXPORT_HEADERS))
  headerRow.height = 24
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2980B9' },
    }
    cell.alignment = { vertical: 'middle' }
  })

  rows.forEach((exportRow) => {
    const row = worksheet.addRow(exportRow.spreadsheet)
    for (let columnIndex = 7; columnIndex <= 13; columnIndex += 1) {
      const cell = row.getCell(columnIndex)
      if (typeof cell.value === 'number') cell.numFmt = '0.00'
    }
  })

  worksheet.autoFilter = `A1:N${Math.max(rows.length + 1, 1)}`

  return workbook.xlsx.writeBuffer()
}
