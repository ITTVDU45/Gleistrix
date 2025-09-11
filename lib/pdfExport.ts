import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export async function createPDFForProjectDays(project: any, days: string[]) {
  try {
    const doc: any = new (jsPDF as any)({ orientation: 'landscape', unit: 'mm', format: 'a4' })

    // Logo
    try {
      const { readFileSync, existsSync } = await import('fs')
      const { join } = await import('path')
      const logoPath = join(process.cwd(), 'public', 'mwd-logo.png')
      if (existsSync(logoPath)) {
        const img = readFileSync(logoPath)
        const base64 = `data:image/png;base64,${img.toString('base64')}`
        const pageWidth = doc.internal.pageSize.getWidth()
        const logoW = 80
        const logoH = 40
        const logoX = (pageWidth - logoW) / 2
        doc.addImage(base64, 'PNG', logoX, 30, logoW, logoH)
      }
    } catch (e) {
      // ignore
    }

    const margin = 40
    let y = 110
    // Title (use Zeiterfassung style similar to TimeTrackingExport)
    doc.setFontSize(22)
    doc.text('Zeiterfassung', 40, y)
    // timestamp
    const timestamp = new Date().toLocaleString('de-DE')
    doc.setFontSize(10)
    doc.text(`Exportiert am: ${timestamp}`, 40, y + 18)
    y += 36

    // Summary left / right
    const leftX = 40
    const rightX = doc.internal.pageSize.getWidth() / 2 + 20
    const timesAny: any = project.mitarbeiterZeiten || {}

    // helper to read numeric fields from entry using multiple possible key names
    const readNumberField = (obj: any, keys: string[]) => {
      if (!obj) return 0
      for (const k of keys) {
        const v = obj[k]
        if (v !== undefined && v !== null && v !== '') {
          const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'))
          if (!Number.isNaN(n)) return n
        }
      }
      return 0
    }

    // format hours in H.MM (e.g. 7.30)
    const formatHoursDot = (hours: number): string => {
      const whole = Math.floor(hours)
      const min = Math.round((hours - whole) * 60)
      return `${whole}.${String(min).padStart(2,'0')}`
    }

    // format date/time like in ProjectDetailClient table
    const formatDateTime = (iso: string): string => {
      try {
        if (!iso || typeof iso !== 'string') return String(iso || '-')
        const d = new Date(iso)
        const dd = String(d.getDate()).padStart(2,'0')
        const mm = String(d.getMonth()+1).padStart(2,'0')
        const yyyy = d.getFullYear()
        const hh = String(d.getHours()).padStart(2,'0')
        const mi = String(d.getMinutes()).padStart(2,'0')
        return `${dd}.${mm}.${yyyy} ${hh}:${mi}`
      } catch {
        return String(iso)
      }
    }

    const formatZeit = (start: string, ende: string): string => {
      if (!start || !ende) return start || ende || '-'
      try {
        const sIso = String(start)
        const eIso = String(ende)
        const hasIso = sIso.includes('T') && eIso.includes('T')
        const sDay = hasIso ? sIso.slice(0,10) : ''
        const eDay = hasIso ? eIso.slice(0,10) : ''
        if (hasIso && sDay !== eDay) {
          // cross-day → full date + time for both (ASCII hyphen separator)
          return `${formatDateTime(start)} - ${formatDateTime(ende)}`
        }
        // same day → only times
        const s = sIso.includes('T') ? sIso.slice(11,16) : sIso
        const e = eIso.includes('T') ? eIso.slice(11,16) : eIso
        return `${s} - ${e}`
      } catch {
        return `${start} - ${ende}`
      }
    }

    // compute totals and exported days
    let totalHours = 0
    const uniqueEmployees = new Set<string>()
    const exportedDays: string[] = []
    for (const d of (days || [])) {
      exportedDays.push(String(d))
      const arr = timesAny?.[d] || []
      for (const e of arr) {
        const st = readNumberField(e, ['stunden', 'stunde'])
        totalHours += st
        if (e && (e.name || e.mitarbeiter)) uniqueEmployees.add(e.name || e.mitarbeiter)
      }
    }

    // Übersicht (styled table similar to TimeTrackingExport)
    const summaryStyles = { fontSize: 11, cellPadding: 6 }
    // compute overview totals directly from timesAny and selected days
    let totalEntries = 0
    let totalFahrt = 0
    let totalNacht = 0
    let totalSonntag = 0
    let totalFeiertag = 0
    for (const d of (days || [])) {
      const arr = timesAny?.[d] || []
      totalEntries += Array.isArray(arr) ? arr.length : 0
      for (const e of arr) {
        totalFahrt += readNumberField(e, ['fahrtstunden', 'fahrt', 'fahrtStd'])
        totalNacht += readNumberField(e, ['nachtzulage', 'nachtstunden', 'nacht'])
        // Sonntagsstunden: Korrektur der Feldnamen und explizite Typkonvertierung
        // Prüfe alle möglichen Feldnamen mit Nullish Coalescing Operator
        const sonntagWert = e.sonntagsstunden ?? e.sonntag ?? e.sonntagstunden ?? 0
        // Konvertiere in eine Zahl (mit Komma-zu-Punkt-Umwandlung)
        const sonntagNum = typeof sonntagWert === 'number' 
          ? sonntagWert 
          : parseFloat(String(sonntagWert).replace(',', '.'))
        // Addiere nur wenn es eine gültige Zahl ist
        totalSonntag += Number.isFinite(sonntagNum) ? sonntagNum : 0
        
        // Für Debug-Zwecke
        console.log('Sonntagsstunden Berechnung:', {
          tag: d,
          mitarbeiter: e.name || e.mitarbeiter,
          sonntag: e.sonntag,
          sonntagsstunden: e.sonntagsstunden,
          sonntagstunden: e.sonntagstunden,
          wert: sonntagWert,
          alsZahl: sonntagNum,
          totalSonntag
        })
        totalFeiertag += readNumberField(e, ['feiertag', 'feiertagsstunden'])
        
        // Debug-Log für Sonntagsstunden
        if (e.sonntag !== undefined || e.sonntagsstunden !== undefined || e.sonntagstunden !== undefined) {
          console.log('Sonntagsstunden gefunden:', {
            sonntag: e.sonntag,
            sonntagsstunden: e.sonntagsstunden,
            sonntagstunden: e.sonntagstunden,
            berechnet: readNumberField(e, ['sonntag', 'sonntagsstunden', 'sonntagstunden'])
          })
        }
      }
    }

    // Einfache Übersicht wie in TimeTracking
    doc.setFontSize(16)
    doc.setTextColor(0, 0, 0) // Schwarz für Überschrift
    doc.text('Übersicht', 40, y)
    y += 16

    // Formatierung für Stunden in HH:MM Format für Gesamtstunden
    const formatHoursColon = (hours: number): string => {
      const wholeHours = Math.floor(hours);
      const minutes = Math.round((hours - wholeHours) * 60);
      return `${wholeHours}:${minutes.toString().padStart(2, '0')}`;
    };
    
    // Übersicht-Daten
    const overviewData = [
      { label: 'Anzahl Einträge', value: String(totalEntries) },
      { label: 'Gesamtstunden', value: formatHoursColon(totalHours) },
      { label: 'Fahrtstunden', value: `${formatHoursDot(totalFahrt)}h` },
      { label: 'Nachtstunden', value: `${formatHoursDot(totalNacht)}h` },
      { label: 'Sonntagsstunden', value: `${formatHoursDot(totalSonntag)}h` },
      { label: 'Feiertagsstunden', value: `${formatHoursDot(totalFeiertag)}h` }
    ]

    // Einfache Liste mit Einrückung
    doc.setFontSize(12)
    let lineY = y
    const lineHeight = 6
    
    for (const item of overviewData) {
      doc.setTextColor(0, 0, 0) // Schwarz für Text
      doc.text(`${item.label}: ${item.value}`, 40, lineY)
      lineY += lineHeight * 2
    }
    
    // Aktualisiere y-Position für den nächsten Inhalt
    y = lineY + 10

    // Ensure tables (Technik / Zeiten) always start on a new second page
    try {
      doc.addPage()
      y = margin
    } catch (e) {
      // ignore if addPage fails for any runtime reason
    }

    // Technik (nur für ausgewählte Tage)
    try {
      const technik: any = project.technik || {}
      const rows: any[] = []
      const daysSet = new Set((days || []).map((d:any) => String(d)))
      if (Array.isArray(technik)) {
        technik.forEach((t: any) => {
          const tag = t.tag || t.day || t.datum || t.date || null
          if (tag && daysSet.size > 0 && !daysSet.has(String(tag))) return
          if (!tag && daysSet.size > 0) return // skip undated entries when specific days selected
          rows.push([t.name || '-', t.anzahl || '-', t.meterlaenge || '-', t.bemerkung || '-', tag ? String(tag) : '-'])
        })
      } else {
        Object.entries(technik).forEach(([tag, arr]: any) => {
          if (daysSet.size > 0 && !daysSet.has(String(tag))) return
          (arr as any[]).forEach((t: any) => rows.push([t.name || '-', t.anzahl || '-', t.meterlaenge || '-', t.bemerkung || '-', String(tag)]))
        })
      }
      if (rows.length > 0) {
        // Heading for Technik
        doc.setFontSize(16)
        doc.setTextColor(20)
        doc.text('Technik', margin, y)
        y += 14
        // Technik table styled like Zeiten table
        const techHead = ['Name', 'Anzahl', 'Meterlänge', 'Bemerkung', 'Tag']
        const pageWidth = doc.internal.pageSize.getWidth()
        const availWidth = pageWidth - 12 - 12
        const colCount = techHead.length
        const equalWidth = Math.max(40, Math.floor(availWidth / colCount))
        const colStyles = Object.fromEntries(new Array(colCount).fill(0).map((_,i)=>[i,{cellWidth: equalWidth}]))

        autoTable(doc as any, {
          startY: y + 10,
          head: [techHead],
          body: rows,
          theme: 'grid',
          tableWidth: availWidth,
          styles: { fontSize: 9, cellPadding: 6, overflow: 'linebreak', cellWidth: 'wrap' },
          headStyles: { fillColor: [41,128,185], textColor: 255, fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [245,245,245] },
          columnStyles: colStyles,
          margin: { left: 12, right: 12 }
        })
        y = (doc as any).lastAutoTable.finalY + 18
      }
    } catch (e) {}

    // Zeiten table
    try {
      const entries: any[] = []
      for (const d of (days || [])) {
        const arr = timesAny?.[d] || []
        for (const e of arr) entries.push({
          date: d,
          name: e.name || e.mitarbeiter || '-',
          funktion: e.funktion || '-',
          start: e.start || e.beginn || '-',
          ende: e.ende || e.end || '-',
          stunden: readNumberField(e, ['stunden', 'stunde']),
          pause: e.pause || '-',
          nachtzulage: readNumberField(e, ['nachtzulage', 'nachtstunden', 'nacht']),
          sonntag: readNumberField(e, ['sonntag', 'sonntagsstunden', 'sonntagstunden']),
          feiertag: readNumberField(e, ['feiertag', 'feiertagsstunden']),
          fahrtstunden: readNumberField(e, ['fahrtstunden', 'fahrt']),
          extra: e.extra || '-',
          status: e.status || project.status || '-',
        })
      }
      if (entries.length > 0) {
        doc.setFontSize(14); doc.text('Zeiten', margin, y)
        // Timetracking-style table (match components/TimeTrackingExport.tsx)
        const timeHead = ['Datum','Projektname','Ort','Mitarbeiter','Zeit','Gesamtstunden','Pause','Nachtstunden','Sonntagsstunden','Feiertagsstunden','Fahrtstunden','Extra']
        const formatIsoDate = (iso: string) => {
          try {
            if (!iso) return '-'
            const [y, m, d] = String(iso).split('T')[0].split('-')
            return `${d}.${m}.${y}`
          } catch (e) { return String(iso) }
        }

        const fullRows = entries.map((row:any) => {
          const d = formatIsoDate(row.date)
          const name = row.name || '-'
          const funktion = row.funktion || '-'
          const start = row.start || '-'
          const ende = row.ende || '-'
          const stunden = (typeof row.stunden === 'number') ? formatHoursDot(row.stunden) : String(row.stunden || '-')
          // pause kann als Zahl (Stunden) oder String kommen → als H.MMh ausgeben
          const pauseNum = typeof row.pause === 'number' ? row.pause : parseFloat(String(row.pause).replace(',', '.'))
          const pause = Number.isFinite(pauseNum) ? `${formatHoursDot(pauseNum)}h` : (row.pause || '-')
          // Nachtstunden auch mit readNumberField für konsistente Verarbeitung
          const nachtValue = readNumberField(row, ['nachtzulage', 'nachtstunden', 'nacht'])
          const nacht = nachtValue > 0 ? `${formatHoursDot(nachtValue)}h` : '-'
          // Sonntag kann in verschiedenen Feldern stehen - direkte Prüfung der Feldnamen
          const sonntagWert = row.sonntag || row.sonntagsstunden || row.sonntagstunden || 0
          const sonntagValue = typeof sonntagWert === 'number' ? sonntagWert : parseFloat(String(sonntagWert).replace(',', '.'))
          const sonntag = sonntagValue > 0 ? `${formatHoursDot(sonntagValue)}h` : '-'
          // Feiertag und Fahrt auch mit readNumberField für konsistente Verarbeitung
          const feiertagValue = readNumberField(row, ['feiertag', 'feiertagsstunden'])
          const feiertag = feiertagValue > 0 ? `${formatHoursDot(feiertagValue)}h` : '-'
          
          const fahrtValue = readNumberField(row, ['fahrtstunden', 'fahrt', 'fahrtStd'])
          const fahrt = fahrtValue > 0 ? `${formatHoursDot(fahrtValue)}h` : '-'
          const extra = row.extra || '-'
          const zeit = (start && ende && start !== '-' && ende !== '-') ? formatZeit(start, ende) : (start ? formatDateTime(start) : (ende ? formatDateTime(ende) : '-'))
          const projName = project.name || '-'
          const ort = project.baustelle || project.ort || '-'
          return [d, projName, ort, name, zeit, stunden, pause, nacht, sonntag, feiertag, fahrt, extra]
        })

        // Let autoTable compute widths and use a smaller font/padding so all columns fit on landscape A4
        // compute column widths proportionally to fit the available page width
        const pageWidth = doc.internal.pageSize.getWidth()
        const availWidth = pageWidth - 12 - 12 // left/right margins used below
        // relative weights for columns: Datum, Projektname, Ort, Mitarbeiter, Zeit, Gesamtstunden, Pause, Nacht, Sonntag, Feiertag, Fahrt, Extra
        const weights = [8, 18, 14, 12, 22, 6, 6, 6, 6, 6, 6, 6]
        const weightSum = weights.reduce((s,w)=>s+w,0)
        const colWidths: number[] = weights.map(w => Math.max(10, Math.round((w / weightSum) * availWidth)))

        autoTable(doc as any, {
          startY: y + 10,
          head: [timeHead],
          body: fullRows,
          theme: 'grid',
          tableWidth: availWidth,
          styles: { fontSize: 7, cellPadding: 3, overflow: 'linebreak', cellWidth: 'wrap' },
          headStyles: { fillColor: [41,128,185], textColor: 255, fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [245,245,245] },
          columnStyles: Object.fromEntries(colWidths.map((w,i)=>[i,{cellWidth: w}])) as any,
          margin: { left: 12, right: 12 }
        })
        y = (doc as any).lastAutoTable.finalY + 18
      }
    } catch (e) {}

    // Fahrzeuge (nur für ausgewählte Tage)
    try {
      const fahrzeuge: any = project.fahrzeuge || {}
      const vrows: any[] = []
      const daysSet2 = new Set((days || []).map((d:any) => String(d)))
      if (Array.isArray(fahrzeuge)) {
        fahrzeuge.forEach((v: any) => {
          const tag = v.tag || v.day || v.datum || v.date || null
          if (tag && daysSet2.size > 0 && !daysSet2.has(String(tag))) return
          if (!tag && daysSet2.size > 0) return
          vrows.push([v.type || '-', v.licensePlate || '-', v.kilometers || '-'])
        })
      } else {
        Object.entries(fahrzeuge).forEach(([tag, arr]: any) => {
          if (daysSet2.size > 0 && !daysSet2.has(String(tag))) return
          ;(arr as any[]).forEach((v:any)=> vrows.push([v.type||'-', v.licensePlate||'-', v.kilometers||'-']))
        })
      }
      if (vrows.length > 0) {
        doc.setFontSize(14); doc.text('Fahrzeuge', margin, y)
        autoTable(doc as any, {
          startY: y + 10,
          head: [['Typ', 'Kennzeichen', 'Kilometer']],
          body: vrows,
          styles: { fontSize: 10, cellPadding: 6 },
          headStyles: { fillColor: [245,247,250], textColor: 30 },
          margin: { left: margin, right: margin }
        })
        y = (doc as any).lastAutoTable.finalY + 18
      }
    } catch (e) {}

    const pdfBuffer = Buffer.from(doc.output('arraybuffer'))
    return pdfBuffer
  } catch (e) {
    console.error('createPDFForProjectDays failed:', e)
    throw e
  }
}


