"use client";
import React, { useState } from 'react';
import { Button } from './ui/button';
import { Download } from 'lucide-react';
import jsPDF from 'jspdf';
import { fetchWithIntent } from '@/lib/http/fetchWithIntent';
import autoTable from 'jspdf-autotable';

interface TimeTrackingExportProps {
  timeEntries: any[];
}

export default function TimeTrackingExport({ timeEntries }: TimeTrackingExportProps) {
  // Hilfsfunktion zur Formatierung von Stunden in HH:MM Format
  const formatHours = (hours: number): string => {
    const wholeHours = Math.floor(hours);
    const minutes = Math.round((hours - wholeHours) * 60);
    return `${wholeHours}:${minutes.toString().padStart(2, '0')}`;
  };

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
      
      const totalHours = timeEntries.reduce((sum, entry) => sum + entry.stunden, 0);
      doc.text(`Gesamtstunden: ${formatHours(totalHours)}`, 14, summaryTitleY + 15);
      
      const totalTravelHours = timeEntries.reduce((sum, entry) => sum + entry.fahrtstunden, 0);
      doc.text(`Fahrtstunden: ${totalTravelHours.toFixed(1)}h`, 14, summaryTitleY + 20);
      
      const totalNightHours = timeEntries.reduce((sum, entry) => {
        const nightHours = entry.nachtzulage ? parseFloat(entry.nachtzulage) : 0;
        return sum + nightHours;
      }, 0);
      doc.text(`Nachtstunden: ${totalNightHours.toFixed(1)}h`, 14, summaryTitleY + 25);
      
      const totalSundayHours = timeEntries.reduce((sum, entry) => {
        const sundayHours = entry.sonntag ? parseFloat(entry.sonntag) : 0;
        return sum + sundayHours;
      }, 0);
      doc.text(`Sonntagsstunden: ${totalSundayHours.toFixed(1)}h`, 14, summaryTitleY + 30);
      
      const totalHolidayHours = timeEntries.reduce((sum, entry) => {
        const holidayHours = entry.feiertag ? parseFloat(entry.feiertag) : 0;
        return sum + holidayHours;
      }, 0);
      doc.text(`Feiertagsstunden: ${totalHolidayHours.toFixed(1)}h`, 14, summaryTitleY + 35);
      
      // Tabelle
      const tableTitleY = summaryTitleY + 48;
      doc.setFontSize(14);
      doc.text('Zeiteinträge', 14, tableTitleY);
      
      // Tabellen-Header
      const headers = [
        'Datum',
        'Projektname',
        'Ort',
        'Mitarbeiter',
        'Zeit',
        'Gesamtstunden',
        'Pause',
        'Nachtstunden',
        'Sonntagsstunden',
        'Feiertagsstunden',
        'Fahrtstunden',
        'Extra',
        'Projektstatus'
      ];
      
      // Tabellen-Daten
      const data = timeEntries.map(entry => [
        new Date(entry.date).toLocaleDateString('de-DE'),
        entry.projectName,
        entry.ort || '-',
        entry.name,
        `${entry.start} - ${entry.ende}`,
                        `${formatHours(entry.stunden)}`,
        entry.pause ? `${entry.pause}h` : '-',
        entry.nachtzulage ? `${parseFloat(entry.nachtzulage).toFixed(2)}h` : '-',
        entry.sonntag ? `${parseFloat(entry.sonntag).toFixed(2)}h` : '-',
        entry.feiertag ? `${parseFloat(entry.feiertag).toFixed(2)}h` : '-',
        entry.fahrtstunden > 0 ? `${entry.fahrtstunden}h` : '-',
        entry.extra || '-',
        entry.status
      ]);
      
      // Tabelle erstellen
      autoTable(doc, {
        startY: tableTitleY + 5,
        head: [headers],
        body: data,
        theme: 'grid',
        tableWidth: 'auto',
        styles: {
          fontSize: 8,
          cellPadding: 2,
          overflow: 'linebreak',
        },
        headStyles: {
          fillColor: [41, 128, 185],
          textColor: 255,
          fontStyle: 'bold',
          fontSize: 9,
        },
        alternateRowStyles: {
          fillColor: [245, 245, 245]
        },
        margin: { top: tableTitleY + 5, left: 10, right: 10 }
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