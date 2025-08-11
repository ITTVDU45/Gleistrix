'use client';
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardContent, CardHeader } from '../../components/ui/card';
import { Table, TableBody, TableCell, TableHeader, TableHead, TableRow } from '../../components/ui/table';
import { Badge } from '../../components/ui/badge';
import { Alert, AlertDescription } from '../../components/ui/alert';
import { LoadingCard } from '../../components/ui/loading';
import { Plus, Users, Search, Edit, Trash2, Filter, CheckCircle, AlertCircle, User, Clock, MapPin, Calendar, ChevronDown, ChevronUp, RefreshCw, Download } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import type { Employee, VacationDay, EmployeeStatus } from '../../types/main';
import EmployeeActions from '../../components/EmployeeActions';
import AddEmployeeDialog from '../../components/AddEmployeeDialog';
import EmployeeStatusSelect from '../../components/EmployeeStatusSelect';
import { useEmployees } from '../../hooks/useEmployees';
import MultiSelectDropdown from '../../components/ui/MultiSelectDropdown';
import EmployeeStats from '../../components/EmployeeStats';
import EmployeeFilter from '../../components/EmployeeFilter';
 
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Hilfsfunktion zur Formatierung der Urlaubszeiträume
const formatVacationPeriods = (vacationDays: VacationDay[] | undefined): string => {
  if (!vacationDays || vacationDays.length === 0) {
    return '-';
  }

  // Aktuelle Urlaubszeiträume filtern (heute oder in der Zukunft)
  const today = new Date();
  const currentVacations = vacationDays.filter(vacation => {
    const endDate = new Date(vacation.endDate);
    return endDate >= today;
  });

  if (currentVacations.length === 0) {
    return '-';
  }

  // Sortiere nach Startdatum
  currentVacations.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

  // Formatiere die ersten 2 Urlaubszeiträume
  const formattedVacations = currentVacations.slice(0, 2).map(vacation => {
    const startDate = new Date(vacation.startDate);
    const endDate = new Date(vacation.endDate);
    
    // Wenn Start- und Enddatum im gleichen Monat sind
    if (startDate.getMonth() === endDate.getMonth() && startDate.getFullYear() === endDate.getFullYear()) {
      return `${format(startDate, 'dd.', { locale: de })}-${format(endDate, 'dd.MM', { locale: de })}`;
    } else {
      return `${format(startDate, 'dd.MM', { locale: de })}-${format(endDate, 'dd.MM', { locale: de })}`;
    }
  });

  return formattedVacations.join(', ');
};

// Hilfsfunktion zur Extraktion von Urlaubszeiträumen für Filter
const getVacationPeriods = (vacationDays: VacationDay[] | undefined): string[] => {
  if (!vacationDays || vacationDays.length === 0) {
    return ['Keine Urlaubszeiträume'];
  }

  const today = new Date();
  const currentVacations = vacationDays.filter(vacation => {
    const endDate = new Date(vacation.endDate);
    return endDate >= today;
  });

  if (currentVacations.length === 0) {
    return ['Keine aktuellen Urlaubszeiträume'];
  }

  return currentVacations.map(vacation => {
    const startDate = new Date(vacation.startDate);
    const endDate = new Date(vacation.endDate);
    
    if (startDate.getMonth() === endDate.getMonth() && startDate.getFullYear() === endDate.getFullYear()) {
      return `${format(startDate, 'dd.', { locale: de })}-${format(endDate, 'dd.MM', { locale: de })}`;
    } else {
      return `${format(startDate, 'dd.MM', { locale: de })}-${format(endDate, 'dd.MM', { locale: de })}`;
    }
  });
};

export default function MitarbeiterPage() {
  const { employees, loading, error, setEmployeeStatus, isEmployeeOnVacation, updateAllEmployeeStatusesBasedOnVacation } = useEmployees();
  const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusUpdateError, setStatusUpdateError] = useState<string | null>(null);
  const [isUpdatingStatuses, setIsUpdatingStatuses] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean, message: string, severity: 'success'|'error' }>({ open: false, message: '', severity: 'success' });

  // Keine Sperrlogik auf der Übersicht – Sperren gelten nur auf Mitarbeiter-Detailseiten

  // Snackbar schließen
  const closeSnackbar = () => {
    setSnackbar({ open: false, message: '', severity: 'success' });
  };

  // Snackbar automatisch schließen
  useEffect(() => {
    if (snackbar.open) {
      const timer = setTimeout(() => {
        closeSnackbar();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [snackbar.open]);

  // Gefilterte Mitarbeiter an Parent-Komponente übergeben
  useEffect(() => {
    // Freitextsuche anwenden
    const term = searchTerm.trim().toLowerCase();
    if (!term) {
      setFilteredEmployees(employees);
      return;
    }
    const next = employees.filter((e) => {
      const fields: string[] = [
        e.name,
        e.elbaId || '',
        e.position || '',
        e.status || '',
        e.email || '',
        e.phone || '',
        e.address || '',
        e.postalCode || '',
        e.city || '',
      ].map((v) => v.toString().toLowerCase());
      return fields.some((v) => v.includes(term));
    });
    setFilteredEmployees(next);
  }, [employees, searchTerm]);

  // Automatische Status-Anpassung beim Laden der Seite (nur einmal pro Session, ohne Snackbar)
  useEffect(() => {
    if (employees.length > 0) {
      const AUTO_STATUS_UPDATED_KEY = 'employee-auto-status-updated';
      const alreadyUpdated = typeof window !== 'undefined' ? sessionStorage.getItem(AUTO_STATUS_UPDATED_KEY) : '1';
      if (alreadyUpdated) return;
      const timer = setTimeout(() => {
        handleAutoUpdateStatuses(true); // silent run
        try { sessionStorage.setItem(AUTO_STATUS_UPDATED_KEY, '1'); } catch {}
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [employees]);

  // Hilfsfunktion: Prüft, ob ein Mitarbeiter aktuell im Urlaub ist
  const isCurrentlyOnVacation = (employee: Employee): boolean => {
    if (!employee.vacationDays || employee.vacationDays.length === 0) {
      return false;
    }
    
    const today = new Date();
    console.log(`Prüfe Urlaub für ${employee.name}:`);
    console.log(`  Heute: ${today.toISOString()}`);
    
    const isOnVacation = employee.vacationDays.some(vacation => {
      const startDate = new Date(vacation.startDate);
      const endDate = new Date(vacation.endDate);
      const isCurrentlyOnVacation = today >= startDate && today <= endDate;
      
      console.log(`  Urlaub: ${startDate.toISOString()} - ${endDate.toISOString()}`);
      console.log(`  Ist aktuell im Urlaub: ${isCurrentlyOnVacation}`);
      
      return isCurrentlyOnVacation;
    });
    
    console.log(`  Ergebnis für ${employee.name}: ${isOnVacation}`);
    return isOnVacation;
  };

  // Status-Änderung mit automatischer Urlaubsanpassung
  const handleStatusChange = async (employeeId: string, newStatus: EmployeeStatus) => {
    try {
      await setEmployeeStatus(employeeId, newStatus);
      setSnackbar({
        open: true,
        message: 'Mitarbeiterstatus erfolgreich aktualisiert',
        severity: 'success'
      });
    } catch (error) {
      setSnackbar({
        open: true,
        message: 'Fehler beim Aktualisieren des Mitarbeiterstatus',
        severity: 'error'
      });
    }
  };

  // Automatische Status-Anpassung basierend auf Urlaubszeiten
  const handleAutoUpdateStatuses = async (silent: boolean = false) => {
    setIsUpdatingStatuses(true);
    setStatusUpdateError(null);
    
    try {
      await updateAllEmployeeStatusesBasedOnVacation();
      if (!silent) {
        setSnackbar({
          open: true,
          message: 'Alle Mitarbeiterstatus automatisch angepasst',
          severity: 'success'
        });
      }
    } catch (error) {
      setStatusUpdateError('Fehler beim automatischen Anpassen der Status');
      if (!silent) {
        setSnackbar({
          open: true,
          message: 'Fehler beim automatischen Anpassen der Status',
          severity: 'error'
        });
      }
    } finally {
      setIsUpdatingStatuses(false);
    }
  };


  // PDF Export Funktion
  const exportToPDF = () => {
    const doc = new jsPDF();
    
    // Titel
    doc.setFontSize(20);
    doc.text('Mitarbeiter Übersicht', 20, 20);
    
    // Datum
    doc.setFontSize(12);
    doc.text(`Erstellt am: ${format(new Date(), 'dd.MM.yyyy', { locale: de })}`, 20, 30);
    
    // Tabelle
    const tableData = filteredEmployees.map(employee => [
      employee.name,
      employee.elbaId || '-',
      employee.position || '-',
      employee.status || 'aktiv',
      employee.email || '-',
      employee.phone || '-',
      formatVacationPeriods(employee.vacationDays)
    ]);
    
    autoTable(doc, {
      head: [['Name', 'ElBa-Nr.', 'Position', 'Status', 'E-Mail', 'Telefon', 'Urlaub']],
      body: tableData,
      startY: 40,
      styles: {
        fontSize: 8,
        cellPadding: 2
      },
      headStyles: {
        fillColor: [59, 130, 246],
        textColor: 255
      }
    });
    
    doc.save('mitarbeiter-uebersicht.pdf');
  };

  if (loading) {
    return <LoadingCard />;
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Fehler beim Laden der Mitarbeiter: {error}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="p-4 bg-white dark:bg-slate-900 min-h-screen">
      {/* Keine Locking-Status Anzeige auf der Übersicht */}

      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-[#114F6B] dark:text-white">Mitarbeiter</h1>
        <div className="flex items-center gap-2">
          <Button
            onClick={exportToPDF}
            className="bg-blue-700 hover:bg-blue-800 text-white rounded-xl shadow-lg px-6 h-12 employee-create-button"
            
          >
            <Download className="h-4 w-4 mr-2" />
            PDF Export
          </Button>
          <AddEmployeeDialog />
        </div>
      </div>

      {/* Status Update Fehlermeldung */}
      {statusUpdateError && (
        <Alert variant="destructive" className="rounded-xl">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{statusUpdateError}</AlertDescription>
        </Alert>
      )}

      {/* Statistik-Karten (reagieren auf Filter) */}
      <EmployeeStats employees={filteredEmployees} />

      {/* Mitarbeiter Tabelle */}
      <Card className="border-0 shadow-lg bg-white dark:bg-slate-800 rounded-xl employees-table">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Mitarbeiter Übersicht</h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                {filteredEmployees.length} von {employees.length} Mitarbeitern
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filter-Zeile */}
          <EmployeeFilter
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            onClearFilters={() => setSearchTerm('')}
          />

          {filteredEmployees.length > 0 ? (
            <div className="rounded-xl border border-slate-200 dark:border-slate-600 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 dark:bg-slate-700">
                    <TableHead className="font-medium text-slate-700 dark:text-slate-300">Name</TableHead>
                    <TableHead className="font-medium text-slate-700 dark:text-slate-300">ElBa-Nr.</TableHead>
                    <TableHead className="font-medium text-slate-700 dark:text-slate-300">Position</TableHead>
                    <TableHead className="font-medium text-slate-700 dark:text-slate-300">Status</TableHead>
                    <TableHead className="font-medium text-slate-700 dark:text-slate-300">Kontakt</TableHead>
                    <TableHead className="font-medium text-slate-700 dark:text-slate-300">Adresse</TableHead>
                    <TableHead className="font-medium text-slate-700 dark:text-slate-300">Urlaub</TableHead>
                    <TableHead className="font-medium text-slate-700 dark:text-slate-300 text-right">Aktionen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEmployees.map((employee) => (
                    <TableRow key={employee.id} className="hover:bg-slate-50 dark:hover:bg-slate-700">
                      <TableCell className="font-medium dark:text-white">{employee.name}</TableCell>
                      <TableCell className="dark:text-slate-300">{employee.elbaId || '-'}</TableCell>
                      <TableCell className="dark:text-slate-300">{employee.position || '-'}</TableCell>
                      <TableCell>
                        <EmployeeStatusSelect
                          employee={employee}
                          currentStatus={employee.status || 'aktiv'}
                          onStatusChange={handleStatusChange}
                          isCurrentlyOnVacation={isCurrentlyOnVacation(employee)}
                        />
                      </TableCell>
                      <TableCell className="dark:text-slate-300">
                        <div className="space-y-1">
                          {employee.email && (
                            <div className="text-xs">{employee.email}</div>
                          )}
                          {employee.phone && (
                            <div className="text-xs">{employee.phone}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="dark:text-slate-300">
                        <div className="space-y-1">
                          {employee.address && (
                            <div className="text-xs">{employee.address}</div>
                          )}
                          {(employee.postalCode || employee.city) && (
                            <div className="text-xs">
                              {employee.postalCode} {employee.city}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="dark:text-slate-300">
                        <div className="text-xs">
                          {formatVacationPeriods(employee.vacationDays)}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <EmployeeActions employee={employee} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-slate-400 dark:text-slate-500 mx-auto mb-4" />
              <p className="text-slate-600 dark:text-slate-400">Keine Mitarbeiter gefunden</p>
              <p className="text-sm text-slate-500 dark:text-slate-500 mt-1">
                {employees.length === 0 ? 'Erstellen Sie Ihren ersten Mitarbeiter' : 'Passen Sie Ihre Filter an'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Kein Resource Lock Dialog auf der Übersicht */}

      {/* Snackbar */}
      {snackbar.open && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg ${
          snackbar.severity === 'success' 
            ? 'bg-green-500 text-white' 
            : 'bg-red-500 text-white'
        }`}>
          {snackbar.message}
          <button 
            onClick={closeSnackbar}
            className="ml-2 text-white hover:text-gray-200"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
} 