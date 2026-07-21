"use client";
import { logger } from '@/lib/logger'
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDown, Download, FileSpreadsheet, FileText, Table2 } from 'lucide-react';
import jsPDF from 'jspdf';
import { fetchWithIntent } from '@/lib/http/fetchWithIntent';
import autoTable from 'jspdf-autotable';
import type { TimeTrackingExportData, TimeEntry } from '../types';
import {
  TIME_TRACKING_EXPORT_HEADERS,
  createTimeTrackingCsv,
  createTimeTrackingExportFilename,
  createTimeTrackingExportRows,
} from '@/lib/timeTrackingExport';

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

  // helper to robustly parse numeric values (accepts number or string with comma)
  const parseNumber = (val: any): number => {
    if (typeof val === 'number') return val
    const n = parseFloat(String(val || '0').replace(',', '.'))
    return Number.isFinite(n) ? n : 0
  }

  const getEntryMultiplier = (entry: any): number => {
    if (!entry?.isExternal) return 1
    const count = typeof entry.externalCount === 'number' ? entry.externalCount : parseFloat(String(entry.externalCount || 1))
    return Number.isFinite(count) && count > 0 ? count : 1
  }

  const [isExporting, setIsExporting] = useState(false);
  const [exportingFormat, setExportingFormat] = useState<'PDF' | 'Excel' | 'CSV' | null>(null);

  const exportRows = React.useMemo(
    () => createTimeTrackingExportRows(timeEntries as unknown as Array<Record<string, unknown>>),
    [timeEntries]
  );

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const handleExportPDF = async () => {
    setIsExporting(true);
    setExportingFormat('PDF');
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
        logger.warn('Logo konnte nicht geladen werden:', e);
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
        return sum + st * getEntryMultiplier(entry);
      }, 0);
      doc.text(`Gesamtstunden: ${formatHours(totalHours)}`, 14, summaryTitleY + 15);
      
      const totalTravelHours = timeEntries.reduce((sum, rawEntry) => {
        const entry: any = rawEntry as any;
        const f = typeof entry.fahrtstunden === 'number' ? entry.fahrtstunden : parseFloat(String(entry.fahrtstunden || 0)) || 0;
        return sum + f * getEntryMultiplier(entry);
      }, 0);
      doc.text(`Fahrtstunden: ${totalTravelHours.toFixed(1)}h`, 14, summaryTitleY + 20);
      
      const totalNightHours = timeEntries.reduce((sum, rawEntry) => {
        const entry: any = rawEntry as any;
        return sum + parseNumber(entry.nachtzulage) * getEntryMultiplier(entry);
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
        logger.debug('Sonntagsstunden in TimeTrackingExport:', {
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
        
        const multiplier = getEntryMultiplier(entry);
        return sum + (Number.isFinite(sonntagNum) ? sonntagNum * multiplier : 0);
      }, 0);
      doc.text(`Sonntagsstunden: ${totalSundayHours.toFixed(1)}h`, 14, summaryTitleY + 30);
      
      const totalHolidayHours = timeEntries.reduce((sum, rawEntry) => {
        const entry: any = rawEntry as any;
        return sum + parseNumber(entry.feiertag) * getEntryMultiplier(entry);
      }, 0);
      doc.text(`Feiertagsstunden: ${totalHolidayHours.toFixed(1)}h`, 14, summaryTitleY + 35);
      
      // Extrastunden berechnen (versuche numerische Werte aus dem extra-Feld zu extrahieren)
      const totalExtraHours = timeEntries.reduce((sum, rawEntry) => {
        const entry: any = rawEntry as any;
        const extraVal = entry.extra;
        const multiplier = getEntryMultiplier(entry);
        // Versuche, numerische Werte zu extrahieren (z.B. "2.5" oder "2,5")
        if (typeof extraVal === 'number') {
          return sum + (extraVal * multiplier);
        } else if (typeof extraVal === 'string') {
          const numMatch = extraVal.match(/[\d,.]+/);
          if (numMatch) {
            const num = parseFloat(numMatch[0].replace(',', '.'));
            if (Number.isFinite(num)) {
              return sum + (num * multiplier);
            }
          }
        }
        return sum;
      }, 0);
      doc.text(`Extrastunden: ${totalExtraHours.toFixed(1)}h`, 14, summaryTitleY + 40);
      
      // Tabelle
      const tableTitleY = summaryTitleY + 53;
      doc.setFontSize(14);
      doc.text('Zeiteinträge', 14, tableTitleY);
      
      const headers = Array.from(TIME_TRACKING_EXPORT_HEADERS);
      const data = exportRows.map((row) => row.display);

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
      
      doc.save(createTimeTrackingExportFilename('pdf'));
    } catch (error) {
      logger.error('Fehler beim PDF-Export:', error);
    } finally {
      setIsExporting(false);
      setExportingFormat(null);
    }
  };

  const handleExportExcel = async () => {
    setIsExporting(true);
    setExportingFormat('Excel');
    try {
      const {
        createTimeTrackingExcelBuffer,
        TIME_TRACKING_EXCEL_MIME,
      } = await import('@/lib/timeTrackingExcel');
      const buffer = await createTimeTrackingExcelBuffer(exportRows);
      downloadBlob(
        new Blob([buffer], { type: TIME_TRACKING_EXCEL_MIME }),
        createTimeTrackingExportFilename('xlsx')
      );
    } catch (error) {
      logger.error('Fehler beim Excel-Export:', error);
    } finally {
      setIsExporting(false);
      setExportingFormat(null);
    }
  };

  const handleExportCSV = () => {
    setIsExporting(true);
    setExportingFormat('CSV');
    try {
      const csv = createTimeTrackingCsv(exportRows);
      downloadBlob(
        new Blob([csv], { type: 'text/csv;charset=utf-8' }),
        createTimeTrackingExportFilename('csv')
      );
    } catch (error) {
      logger.error('Fehler beim CSV-Export:', error);
    } finally {
      setIsExporting(false);
      setExportingFormat(null);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          disabled={isExporting}
          className="flex items-center gap-2 rounded-xl bg-orange-600 text-white shadow-lg transition-all duration-200 hover:bg-orange-700 hover:shadow-xl"
        >
          <Download className="h-4 w-4" />
          {isExporting ? `Exportiere ${exportingFormat}...` : 'Exportieren'}
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onSelect={() => void handleExportPDF()}>
          <FileText className="h-4 w-4" />
          PDF
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void handleExportExcel()}>
          <FileSpreadsheet className="h-4 w-4" />
          Excel (.xlsx)
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={handleExportCSV}>
          <Table2 className="h-4 w-4" />
          CSV
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
} 
