"use client";
import React, { useState } from 'react';
import { Button } from './ui/button';
import { Download } from 'lucide-react';
import jsPDF from 'jspdf';
import { fetchWithIntent } from '@/lib/http/fetchWithIntent';
import autoTable from 'jspdf-autotable';
import type { TimeTrackingExportData, TimeEntry } from '../types';

interface TimeTrackingExportProps {
  // Accept either fully shaped export data or TimeEntry objects (mapping handled in code)
  timeEntries: Array<TimeTrackingExportData | Partial<TimeTrackingExportData> | TimeEntry>;
}

export default function TimeTrackingExport({ timeEntries }: TimeTrackingExportProps) {
  // Hilfsfunktion zur Formatierung von Stunden in HH:MM Format
  const formatHours = (hours: number): string => {
    const wholeHours = Math.floor(hours);
    const minutes = Math.round((hours - wholeHours) * 60);
    return `${wholeHours}:${minutes.toString().padStart(2, '0')}`;
  };

  const formatHoursDot = (value: any): string => {
    const num = typeof value === 'number' ? value : parseFloat(String(value).replace(',', '.'))
    if (Number.isNaN(num)) return '-'
    const whole = Math.floor(num)
    const minutes = Math.round((num - whole) * 60)
    return `${whole}.${String(minutes).padStart(2, '0')}`
  }

  const formatZeit = (start: string, ende: string): string => {
    if (!start || !ende) return start || ende || '-'
    const sIso = String(start)
    const eIso = String(ende)
    const hasIso = sIso.includes('T') && eIso.includes('T')
    const sDay = hasIso ? sIso.slice(0,10) : ''
    const eDay = hasIso ? eIso.slice(0,10) : ''
    if (hasIso && sDay !== eDay) {
      const d = (iso: string) => {
        const dt = new Date(iso)
        const dd = String(dt.getDate()).padStart(2,'0')
        const mm = String(dt.getMonth()+1).padStart(2,'0')
        const yyyy = dt.getFullYear()
        const hh = String(dt.getHours()).padStart(2,'0')
        const mi = String(dt.getMinutes()).padStart(2,'0')
        return `${dd}.${mm}.${yyyy} ${hh}:${mi}`
      }
      return `${d(sIso)} - ${d(eIso)}`
    }
    const s = sIso.includes('T') ? sIso.slice(11,16) : sIso
    const e = eIso.includes('T') ? eIso.slice(11,16) : eIso
    return `${s} - ${e}`
  }

  // helper to robustly parse numeric values (accepts number or string with comma)
  const parseNumber = (val: any): number => {
    if (typeof val === 'number') return val
    const n = parseFloat(String(val || '0').replace(',', '.'))
    return Number.isFinite(n) ? n : 0
  }

  const [isExporting, setIsExporting] = useState(false);

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      // Landscape für mehr Tabellen-Breite
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const timestamp = new Date().toLocaleString('de-DE');

      // Logo einbinden
      let titleY = 20;
      try {
        const resLogo = await fetchWithIntent('/mwd-logo.png', { cache: 'no-cache' } as any);
        if (resLogo.ok) {
          const blob = await resLogo.blob();
          const dataUrl: string = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
          const pageWidth = doc.internal.pageSize.getWidth();
          const logoY = 10;
          const logoW = 35;
          const logoH = 20;
          const logoX = (pageWidth - logoW) / 2; // mittig platzieren
          doc.addImage(dataUrl, 'PNG', logoX, logoY, logoW, logoH);
          titleY = logoY + logoH + 6;
        }
      } catch (e) {
        console.warn('Logo konnte nicht geladen werden:', e);
      }

      // Titel
      doc.setFontSize(20);
      doc.text('Zeiterfassung', 14, titleY);
      doc.setFontSize(12);
      doc.text(`Exportiert am: ${timestamp}`, 14, titleY + 8);
      
      // Zusammenfassung
      const summaryTitleY = titleY + 23;
      doc.setFontSize(14);
      doc.text('Übersicht', 14, summaryTitleY);
      doc.setFontSize(10);
      doc.text(`Anzahl Einträge: ${timeEntries.length}`, 14, summaryTitleY + 10);
      
      const totalHours = timeEntries.reduce((sum, rawEntry) => {
        const entry: any = rawEntry as any;
        const st = typeof entry.stunden === 'number' ? entry.stunden : parseFloat(String(entry.stunden || 0)) || 0;
        return sum + st;
      }, 0);
      doc.text(`Gesamtstunden: ${formatHours(totalHours)}`, 14, summaryTitleY + 15);
      
      const totalTravelHours = timeEntries.reduce((sum, rawEntry) => {
        const entry: any = rawEntry as any;
        const f = typeof entry.fahrtstunden === 'number' ? entry.fahrtstunden : parseFloat(String(entry.fahrtstunden || 0)) || 0;
        return sum + f;
      }, 0);
      doc.text(`Fahrtstunden: ${totalTravelHours.toFixed(1)}h`, 14, summaryTitleY + 20);
      
      const totalNightHours = timeEntries.reduce((sum, rawEntry) => {
        const entry: any = rawEntry as any;
        return sum + parseNumber(entry.nachtzulage);
      }, 0);
      doc.text(`Nachtstunden: ${totalNightHours.toFixed(1)}h`, 14, summaryTitleY + 25);
      
      // Sonntagsstunden aus verschiedenen möglichen Feldern auslesen und summieren
      const totalSundayHours = timeEntries.reduce((sum, rawEntry) => {
        const entry: any = rawEntry as any;
        // Prüfe alle möglichen Feldnamen und nehme den ersten vorhandenen Wert
        const sonntagWert = entry.sonntagsstunden ?? entry.sonntag ?? entry.sonntagstunden ?? 0;
        // Konvertiere in eine Zahl (mit Komma-zu-Punkt-Umwandlung)
        const sonntagNum = typeof sonntagWert === 'number' 
          ? sonntagWert 
          : parseFloat(String(sonntagWert).replace(',', '.'));
        
        // Debug-Log für jeden Eintrag
        console.log('Sonntagsstunden in TimeTrackingExport:', {
          mitarbeiter: entry.name || entry.mitarbeiter,
          datum: entry.date,
          sonntag: entry.sonntag,
          sonntagsstunden: entry.sonntagsstunden,
          sonntagstunden: entry.sonntagstunden,
          verwendeterWert: sonntagWert,
          alsZahl: sonntagNum,
          bisherigeSumme: sum,
          neueSumme: sum + (Number.isFinite(sonntagNum) ? sonntagNum : 0)
        });
        
        return sum + (Number.isFinite(sonntagNum) ? sonntagNum : 0);
      }, 0);
      doc.text(`Sonntagsstunden: ${totalSundayHours.toFixed(1)}h`, 14, summaryTitleY + 30);
      
      const totalHolidayHours = timeEntries.reduce((sum, rawEntry) => {
        const entry: any = rawEntry as any;
        return sum + parseNumber(entry.feiertag);
      }, 0);
      doc.text(`Feiertagsstunden: ${totalHolidayHours.toFixed(1)}h`, 14, summaryTitleY + 35);
      
      // Tabelle
      const tableTitleY = summaryTitleY + 48;
      doc.setFontSize(14);
      doc.text('Zeiteinträge', 14, tableTitleY);
      
      // Tabellen-Header (wie auf Zeiterfassung)
      const headers = [
        'Datum', 'Projektname', 'Ort', 'Mitarbeiter', 'Funktion', 'Zeit', 'Gesamtstunden', 'Pause', 'Nachtstunden', 'Sonntagsstunden', 'Feiertagsstunden', 'Fahrtstunden', 'Extra', 'Projektstatus'
      ];

      const data = timeEntries.map(rawEntry => {
        const entry: any = rawEntry as any;
        const date = entry.date ? new Date(entry.date).toLocaleDateString('de-DE') : '-'
        const projekt = entry.projectName || entry.project || '-'
        const ort = entry.ort || entry.location || '-' 
        const name = entry.name || entry.mitarbeiter || '-'
        const funktion = entry.funktion || entry.role || entry.position || '-'
        const start = entry.start || entry.beginn || '-'
        const ende = entry.ende || entry.end || '-'
        const zeit = (start && ende && start !== '-' && ende !== '-') ? formatZeit(start, ende) : start || ende || '-'
        const gesamt = typeof entry.stunden === 'number' ? formatHours(entry.stunden) : (entry.stunden ? String(entry.stunden) : '-')
        const pauseNum = typeof entry.pause === 'number' ? entry.pause : parseNumber(entry.pause)
        const pause = Number.isFinite(pauseNum) && pauseNum > 0 ? `${formatHoursDot(pauseNum)}h` : '-'
        const nacht = entry.nachtzulage !== undefined && entry.nachtzulage !== null && entry.nachtzulage !== '' ? `${formatHoursDot(parseNumber(entry.nachtzulage))}h` : '-'
        const sonntagVal = entry.sonntagsstunden ?? entry.sonntag
        const sonntag = sonntagVal !== undefined && sonntagVal !== null && sonntagVal !== '' ? `${formatHoursDot(parseNumber(sonntagVal)) }h` : '-'
        const feiertag = entry.feiertag !== undefined && entry.feiertag !== null && entry.feiertag !== '' ? `${formatHoursDot(parseNumber(entry.feiertag))}h` : '-'
        const fahrtNum = entry.fahrtstunden ?? entry.fahrt
        const fahrt = fahrtNum !== undefined && fahrtNum !== null && fahrtNum !== '' ? `${formatHoursDot(parseNumber(fahrtNum))}h` : '-'
        const extra = entry.extra || '-'
        const status = entry.status || entry.projectStatus || '-'
        return [date, projekt, ort, name, funktion, zeit, gesamt, pause, nacht, sonntag, feiertag, fahrt, extra, status]
      })

      // Spaltenbreiten proportional auf Landscape A4 verteilen, damit nichts abgeschnitten wird
      const pageWidth = doc.internal.pageSize.getWidth()
      const marginL = 12
      const marginR = 12
      const availWidth = pageWidth - marginL - marginR
      // Gewichte: Datum, Projekt, Ort, Mitarbeiter, Funktion, Zeit, Gesamt, Pause, Nacht, Sonntag, Feiertag, Fahrt, Extra, Status
      const weights = [8, 16, 12, 10, 10, 18, 7, 6, 7, 7, 7, 7, 9, 10]
      const weightSum = weights.reduce((s,w)=>s+w,0)
      const colWidths: number[] = weights.map(w => Math.max(10, Math.round((w / weightSum) * availWidth)))

      autoTable(doc, {
        startY: tableTitleY + 5,
        head: [headers],
        body: data,
        theme: 'grid',
        tableWidth: availWidth,
        styles: {
          fontSize: 7,
          cellPadding: 3,
          overflow: 'linebreak',
          cellWidth: 'wrap'
        },
        headStyles: {
          fillColor: [41, 128, 185],
          textColor: 255,
          fontStyle: 'bold'
        },
        alternateRowStyles: {
          fillColor: [245, 245, 245]
        },
        columnStyles: Object.fromEntries(colWidths.map((w,i)=>[i,{ cellWidth: w }])) as any,
        margin: { left: marginL, right: marginR },
        pageBreak: 'auto'
      });
      
      doc.save(`Zeiterfassung_${timestamp.replace(/[:.]/g, '-')}.pdf`);
    } catch (error) {
      console.error('Fehler beim PDF-Export:', error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button 
      onClick={handleExportPDF}
      disabled={isExporting}
      className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
    >
      <Download className="h-4 w-4" />
      {isExporting ? 'Exportiere...' : 'PDF Export'}
    </Button>
  );
} 