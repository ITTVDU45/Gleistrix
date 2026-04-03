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
import { Plus, Users, Building2, Search, Edit, Trash2, Filter, CheckCircle, AlertCircle, User, Clock, MapPin, Calendar, ChevronDown, ChevronUp, RefreshCw, Download } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { useSubcompanies } from '../../hooks/useSubcompanies';
import SubcompanyDialog from '../../components/SubcompanyDialog';
import SubcompanyActions from '../../components/SubcompanyActions';
 
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
  const searchParams = useSearchParams();
  const { employees, loading, error, setEmployeeStatus, isEmployeeOnVacation, updateAllEmployeeStatusesBasedOnVacation } = useEmployees();
  const { subcompanies, loading: subcompaniesLoading, error: subcompaniesError, addSubcompany, updateSubcompany, deleteSubcompany } = useSubcompanies();
  const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusUpdateError, setStatusUpdateError] = useState<string | null>(null);
  const [isUpdatingStatuses, setIsUpdatingStatuses] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean, message: string, severity: 'success'|'error' }>({ open: false, message: '', severity: 'success' });
  const [activeTab, setActiveTab] = useState<'employees' | 'subcompanies'>('employees');
  const [isAddSubOpen, setIsAddSubOpen] = useState(false);
  const [isAddEmployeeOpen, setIsAddEmployeeOpen] = useState(false);
  const [employeeDialogTab, setEmployeeDialogTab] = useState<'internal' | 'external'>('internal');

  useEffect(() => {
    const tab = searchParams?.get('tab');
    const openSub = searchParams?.get('addSub');
    const openEmployee = searchParams?.get('addEmployee');
    const employeeTab = searchParams?.get('employeeTab');
    if (tab === 'subcompanies') {
      setActiveTab('subcompanies');
    }
    if (tab === 'employees') {
      setActiveTab('employees');
    }
    if (openSub === '1') {
      setActiveTab('subcompanies');
      setIsAddSubOpen(true);
    }
    if (openEmployee === '1') {
      setActiveTab('employees');
      setEmployeeDialogTab(employeeTab === 'external' ? 'external' : 'internal');
      setIsAddEmployeeOpen(true);
    }
  }, [searchParams]);

  useEffect(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    if (!normalizedSearch) {
      setFilteredEmployees(employees);
      return;
    }
    setFilteredEmployees(
      employees.filter(employee => {
        const haystack = [
          employee.name,
          employee.position,
          employee.email,
          employee.phone,
          employee.elbaId,
          employee.city,
          employee.address,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(normalizedSearch);
      })
    );
  }, [employees, searchTerm]);

  // Keine Sperrlogik auf der Übersicht – Sperren gelten nur auf Mitarbeiter-Detailseiten

  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('Mitarbeiter Übersicht', 14, 18);

    const rows = (filteredEmployees.length > 0 ? filteredEmployees : employees).map((employee) => [
      employee.name || '-',
      employee.elbaId || '-',
      employee.position || '-',
      employee.status || '-',
      employee.email || '-',
      employee.phone || '-',
      employee.city || '-',
    ]);

    autoTable(doc, {
      startY: 26,
      head: [['Name', 'ElBa-Nr.', 'Position', 'Status', 'E-Mail', 'Telefon', 'Ort']],
      body: rows,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [30, 64, 175] },
    });

    doc.save('mitarbeiter-uebersicht.pdf');
  };

  const handleStatusChange = async (employeeId: string, status: EmployeeStatus) => {
    try {
      await setEmployeeStatus(employeeId, status);
      setSnackbar({ open: true, message: 'Mitarbeiterstatus erfolgreich aktualisiert', severity: 'success' });
    } catch (err: any) {
      console.error('Fehler beim Aktualisieren des Mitarbeiterstatus:', err);
      setSnackbar({ open: true, message: err?.message || 'Fehler beim Aktualisieren des Mitarbeiterstatus', severity: 'error' });
    }
  };

  const isCurrentlyOnVacation = (employee: Employee) => isEmployeeOnVacation(employee);

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

  return (
  <div className="p-4 bg-white dark:bg-slate-900 min-h-screen">
    {/* Keine Locking-Status Anzeige auf der Uebersicht */}

    <div className="flex justify-between items-center mb-6">
      <h1 className="text-3xl font-bold text-[#114F6B] dark:text-white">Mitarbeiter</h1>
      <div className="flex items-center gap-2">
        {activeTab === 'employees' ? (
          <>
            <Button
              onClick={exportToPDF}
              className="bg-blue-700 hover:bg-blue-800 text-white rounded-xl shadow-lg px-6 h-12 employee-create-button"
            >
              <Download className="h-4 w-4 mr-2" />
              PDF Export
            </Button>
            <AddEmployeeDialog
              open={isAddEmployeeOpen}
              onOpenChange={setIsAddEmployeeOpen}
              defaultTab={employeeDialogTab}
              showTrigger
            />
          </>
        ) : (
          <Button
            onClick={() => setIsAddSubOpen(true)}
            className="bg-blue-700 hover:bg-blue-800 text-white rounded-xl shadow-lg px-6 h-12"
          >
            <Plus className="h-4 w-4 mr-2" />
            Subunternehmen hinzufuegen
          </Button>
        )}
      </div>
    </div>

    {/* Status Update Fehlermeldung */}
    {statusUpdateError && (
      <Alert variant="destructive" className="rounded-xl">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{statusUpdateError}</AlertDescription>
      </Alert>
    )}

    <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)} className="space-y-6">
      <TabsList className="rounded-xl bg-slate-100 dark:bg-slate-800">
        <TabsTrigger value="employees" className="rounded-lg">
          Mitarbeiter
        </TabsTrigger>
        <TabsTrigger value="subcompanies" className="rounded-lg">
          Subunternehmen
        </TabsTrigger>
      </TabsList>

      <TabsContent value="employees" className="space-y-6">
        {/* Statistik-Karten (reagieren auf Filter) */}
        <EmployeeStats employees={filteredEmployees} />

        {/* Mitarbeiter Tabelle */}
        <Card className="border-0 shadow-lg bg-white dark:bg-slate-800 rounded-xl employees-table">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Mitarbeiter Uebersicht</h2>
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
                            {employee.email && <div className="text-xs">{employee.email}</div>}
                            {employee.phone && <div className="text-xs">{employee.phone}</div>}
                          </div>
                        </TableCell>
                        <TableCell className="dark:text-slate-300">
                          <div className="space-y-1">
                            {employee.address && <div className="text-xs">{employee.address}</div>}
                            {(employee.postalCode || employee.city) && (
                              <div className="text-xs">
                                {employee.postalCode} {employee.city}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="dark:text-slate-300">
                          <div className="text-xs">{formatVacationPeriods(employee.vacationDays)}</div>
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
      </TabsContent>

      <TabsContent value="subcompanies" className="space-y-6">
        <Card className="border-0 shadow-lg bg-white dark:bg-slate-800 rounded-xl">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Subunternehmen</h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  {subcompanies.length} Subunternehmen
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {subcompaniesError && (
              <Alert variant="destructive" className="rounded-xl mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{subcompaniesError}</AlertDescription>
              </Alert>
            )}
            {subcompaniesLoading ? (
              <div className="text-slate-500">Lade Subunternehmen...</div>
            ) : subcompanies.length > 0 ? (
              <>
                <div className="rounded-xl border border-slate-200 dark:border-slate-600 overflow-hidden hidden lg:block">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50 dark:bg-slate-700">
                        <TableHead className="font-medium text-slate-700 dark:text-slate-300 min-w-[180px]">Name</TableHead>
                        <TableHead className="font-medium text-slate-700 dark:text-slate-300 w-[140px]">Mitarbeiteranzahl</TableHead>
                        <TableHead className="font-medium text-slate-700 dark:text-slate-300 min-w-[140px]">Telefon</TableHead>
                        <TableHead className="font-medium text-slate-700 dark:text-slate-300 min-w-[200px]">E-Mail</TableHead>
                        <TableHead className="font-medium text-slate-700 dark:text-slate-300 min-w-[220px]">Adresse</TableHead>
                        <TableHead className="font-medium text-slate-700 dark:text-slate-300 min-w-[180px]">Bankkonto</TableHead>
                        <TableHead className="font-medium text-slate-700 dark:text-slate-300 text-right">Aktionen</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {subcompanies.map((subcompany) => (
                        <TableRow key={subcompany.id} className="hover:bg-slate-50 dark:hover:bg-slate-700">
                          <TableCell className="font-medium dark:text-white">{subcompany.name}</TableCell>
                          <TableCell className="dark:text-slate-300">{subcompany.employeeCount}</TableCell>
                          <TableCell className="dark:text-slate-300">
                            <div className="text-xs">{subcompany.phone || '-'}</div>
                          </TableCell>
                          <TableCell className="dark:text-slate-300">
                            <div className="text-xs">{subcompany.email || '-'}</div>
                          </TableCell>
                          <TableCell className="dark:text-slate-300">
                            <div className="text-xs">{subcompany.address || '-'}</div>
                          </TableCell>
                          <TableCell className="dark:text-slate-300">
                            <div className="text-xs">{subcompany.bankAccount || '-'}</div>
                          </TableCell>
                          <TableCell className="text-right">
                            <SubcompanyActions
                              subcompany={subcompany}
                              onUpdate={(id, payload) => updateSubcompany(id, payload)}
                              onDelete={async (id) => {
                                await deleteSubcompany(id);
                              }}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="space-y-4 lg:hidden">
                  {subcompanies.map((subcompany) => (
                    <div
                      key={subcompany.id}
                      className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm shadow-slate-200/70 ring-1 ring-white dark:border-slate-700 dark:bg-slate-800 dark:shadow-none dark:ring-0"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <div className="rounded-2xl p-3 ring-1 ring-emerald-100 bg-emerald-50/80 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-200 dark:ring-emerald-900/60">
                            <Building2 className="h-5 w-5" />
                          </div>
                          <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Subunternehmen</p>
                          <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">
                            {subcompany.name}
                          </p>
                          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            {subcompany.employeeCount} Mitarbeiter
                          </p>
                          </div>
                        </div>
                        <div className="pt-1">
                          <SubcompanyActions
                            subcompany={subcompany}
                            onUpdate={(id, payload) => updateSubcompany(id, payload)}
                            onDelete={async (id) => {
                              await deleteSubcompany(id);
                            }}
                          />
                        </div>
                      </div>
                      <div className="mt-4 h-1.5 rounded-full bg-gradient-to-r from-emerald-400 via-emerald-300 to-emerald-200" />
                      <div className="mt-4 grid gap-3 text-sm text-slate-600 dark:text-slate-300">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Telefon</p>
                          <p className="mt-1">{subcompany.phone || '-'}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">E-Mail</p>
                          <p className="mt-1 break-words">{subcompany.email || '-'}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Adresse</p>
                          <p className="mt-1">{subcompany.address || '-'}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Bankkonto</p>
                          <p className="mt-1 break-words">{subcompany.bankAccount || '-'}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center py-12">
                <Users className="h-12 w-12 text-slate-400 dark:text-slate-500 mx-auto mb-4" />
                <p className="text-slate-600 dark:text-slate-400">Keine Subunternehmen vorhanden</p>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>

    <SubcompanyDialog
      open={isAddSubOpen}
      onOpenChange={setIsAddSubOpen}
      title="Subunternehmen hinzufuegen"
      submitLabel="Hinzufuegen"
      onSubmit={(payload) => addSubcompany(payload)}
    />

    {/* Snackbar */}
    {snackbar.open && (
      <div
        className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg ${
          snackbar.severity === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
        }`}
      >
        {snackbar.message}
        <button onClick={closeSnackbar} className="ml-2 text-white hover:text-gray-200">
          x
        </button>
      </div>
    )}
  </div>
);
}
