'use client';
import React from 'react';
import { Button } from './ui/button';
import { Download } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Vehicle } from '../types';

interface VehiclePDFExportProps {
  vehicles: Vehicle[];
}

export default function VehiclePDFExport({ vehicles }: VehiclePDFExportProps) {
  const handleExportPDF = () => {
    const doc = new jsPDF();
    const timestamp = new Date().toLocaleString('de-DE');
    
    doc.setFontSize(20);
    doc.text('Fahrzeugflotte', 14, 20);
    doc.setFontSize(12);
    doc.text(`Exportiert am: ${timestamp}`, 14, 30);
    
    const data = vehicles.map(vehicle => [
      vehicle.type,
      vehicle.licensePlate,
      vehicle.manualStatus || 'verfügbar',
      vehicle.kilometers || 'N/A',
      vehicle.manualStatus || '-'
    ]);
    
    autoTable(doc, {
      startY: 40,
      head: [['Typ', 'Kennzeichen', 'Status', 'Kilometer', 'Manueller Status']],
      body: data,
      theme: 'grid',
      headStyles: { fillColor: [41, 128, 185] },
      styles: { fontSize: 10, cellPadding: 3 }
    });
    
    doc.save(`Fahrzeugflotte_${timestamp.replace(/[:.]/g, '-')}.pdf`);
  };

  return (
    <Button 
      onClick={handleExportPDF}
      className="rounded-lg bg-orange-600 hover:bg-orange-700 text-white"
    >
      <Download className="h-4 w-4 mr-2" />
      PDF Export
    </Button>
  );
} 