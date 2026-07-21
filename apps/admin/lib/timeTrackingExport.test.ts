import { describe, expect, it } from 'vitest'
import ExcelJS from 'exceljs'
import {
  createTimeTrackingCsv,
  createTimeTrackingExportFilename,
  createTimeTrackingExportRows,
} from './timeTrackingExport'
import { createTimeTrackingExcelBuffer } from './timeTrackingExcel'

describe('timeTrackingExport', () => {
  it('normalisiert Zeiteinträge für PDF, Excel und CSV', () => {
    const [row] = createTimeTrackingExportRows([{
      date: '2026-07-20',
      projectName: 'Bauprojekt Nord',
      ort: 'Berlin',
      name: 'Erika Muster',
      funktion: 'SIPO',
      start: '07:00',
      ende: '15:30',
      stunden: 7.5,
      pause: '0,5',
      nachtzulage: 0,
      sonntagsstunden: 1.25,
      feiertag: 0,
      fahrtstunden: 0.75,
      extra: 0.5,
      status: 'aktiv',
    }])

    expect(row.display).toEqual([
      '20.7.2026',
      'Bauprojekt Nord',
      'Berlin',
      'Erika Muster',
      'SIPO',
      '07:00 - 15:30',
      '7:30',
      '0.30h',
      '0.00h',
      '1.15h',
      '0.00h',
      '0.45h',
      '0.30h',
      'aktiv',
    ])
    expect(row.spreadsheet.slice(6, 13)).toEqual([7.5, 0.5, 0, 1.25, 0, 0.75, 0.5])
  })

  it('maskiert Formeln und trennt CSV-Werte Excel-kompatibel', () => {
    const rows = createTimeTrackingExportRows([{
      date: '2026-07-20',
      projectName: '=HYPERLINK("https://example.test")',
      name: 'Muster; Person',
      stunden: 8,
    }])
    const csv = createTimeTrackingCsv(rows)

    expect(csv.startsWith('\uFEFF')).toBe(true)
    expect(csv).toContain('"\'=HYPERLINK(""https://example.test"")"')
    expect(csv).toContain('"Muster; Person"')
    expect(csv).toContain('"8"')
  })

  it('erzeugt sichere, reproduzierbare Dateinamen', () => {
    expect(createTimeTrackingExportFilename('xlsx', new Date('2026-07-21T10:11:12Z')))
      .toBe('Zeiterfassung_2026-07-21-10-11-12.xlsx')
  })

  it('erzeugt eine lesbare XLSX-Datei mit numerischen Stunden', async () => {
    const rows = createTimeTrackingExportRows([{
      date: '2026-07-20',
      projectName: 'Bauprojekt Nord',
      name: 'Erika Muster',
      stunden: 7.5,
      pause: 0.5,
    }])
    const buffer = await createTimeTrackingExcelBuffer(rows)
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buffer)
    const worksheet = workbook.getWorksheet('Zeiterfassung')

    expect(buffer.byteLength).toBeGreaterThan(0)
    expect(worksheet?.getCell('A1').value).toBe('Datum')
    expect(worksheet?.getCell('G2').value).toBe(7.5)
    expect(worksheet?.getCell('G2').numFmt).toBe('0.00')
    expect(worksheet?.getCell('H2').value).toBe(0.5)
  })
})
