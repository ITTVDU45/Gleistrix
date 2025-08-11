"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '../../../components/ui/button';
import { Card, CardContent, CardHeader } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Table, TableBody, TableCell, TableHeader, TableHead, TableRow } from '../../../components/ui/table';
import { Dialog, DialogContent, DialogTitle, DialogFooter } from '../../../components/ui/dialog';
import { Alert, AlertDescription } from '../../../components/ui/alert';
import { Badge } from '../../../components/ui/badge';
import { useEmployees } from '../../../hooks/useEmployees';
import { useProjects } from '../../../hooks/useProjects';
import { useResourceLock } from '../../../hooks/useResourceLock';
import { format, differenceInCalendarDays } from 'date-fns';
import { de } from 'date-fns/locale';
import { Pencil, Trash2, Download, ArrowLeft, Lock, Unlock } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Employee, Project, EmployeeStatus } from '../../../types/main';
import { Checkbox } from '../../../components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '../../../components/ui/popover';
import EmployeeStatusSelect from '../../../components/EmployeeStatusSelect';
import VacationCard from '../../../components/VacationCard';
import EmployeeAssignmentFilter from '../../../components/EmployeeAssignmentFilter';
import EmployeeFilter from '../../../components/EmployeeFilter';
import { ResourceLockDialog } from '../../../components/ui/ResourceLockDialog';
import EditEmployeeDialog from '../../../components/EditEmployeeDialog';

export default function Page() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { data: session } = useSession();
  const { employees, loading, error, updateEmployee, deleteEmployee, setEmployeeStatus, updateEmployeeStatusBasedOnVacation } = useEmployees();
  const { projects, isLoaded: projectsLoaded, error: projectsError } = useProjects();
  const employee = employees.find(emp => emp.id === id);
  
  // Locking-System
  const {
    lockInfo,
    isLoading: lockLoading,
    error: lockError,
    acquireLock,
    releaseLock,
    checkLock
  } = useResourceLock({
    resourceType: 'employee',
    resourceId: id,
    autoAcquire: false, // Automatische Sperrerwerbung deaktiviert
    autoRelease: true, // Automatisch freigeben beim Verlassen der Seite
    activityInterval: 30,
    checkInterval: 15,
    lazyLoad: false,
    userId: (session as any)?.user?.id as string | undefined,
    onLockAcquired: () => {
      console.log('Lock acquired - showing snackbar');
      setSnackbar({
        open: true,
        message: 'Sperre erfolgreich erworben - Sie können jetzt bearbeiten',
        severity: 'success'
      });
    },
    onLockReleased: () => {
      console.log('Lock released - showing snackbar');
      setSnackbar({
        open: true,
        message: 'Sperre wurde freigegeben',
        severity: 'success'
      });
    },
    onLockLost: () => {
      console.log('Lock lost - showing snackbar');
      setSnackbar({
        open: true,
        message: 'Sperre verloren - Mitarbeiter wird von einem anderen Benutzer bearbeitet',
        severity: 'error'
      });
    }
  });

  // Einmaliger Versuch beim ersten Laden: Wenn frei, Sperre erwerben
  const initialAcquireTriedRef = React.useRef(false);
  useEffect(() => {
    const tryInitialAcquire = async () => {
      if (!id || initialAcquireTriedRef.current) return;
      initialAcquireTriedRef.current = true;
      const status = await checkLock(true);
      if (!status.isLocked || status.isOwnLock) {
        if (!status.isOwnLock) {
          await acquireLock();
        }
      }
    };
    tryInitialAcquire();
  }, [id, checkLock, acquireLock]);

  // Unmount-Cleanup: Best-effort Freigabe per sendBeacon
  useEffect(() => {
    return () => {
      if (lockInfo.isOwnLock) {
        navigator.sendBeacon('/api/locks/release', new Blob([JSON.stringify({ resourceType: 'employee', resourceId: id })], { type: 'application/json' }));
      }
    };
  }, [id, lockInfo.isOwnLock]);

  // Hilfsfunktion: Prüfen ob Bearbeitung erlaubt ist (streng)
  const checkEditPermission = useCallback(() => {
    if (lockInfo.isLocked && !lockInfo.isOwnLock) {
      setSnackbar({
        open: true,
        message: 'Mitarbeiter ist von einem anderen Benutzer gesperrt',
        severity: 'error'
      });
      return false;
    }
    return true;
  }, [lockInfo.isLocked, lockInfo.isOwnLock]);

  // Sperre bei Bearbeitungsaktionen erwerben
  const acquireLockOnDemand = useCallback(async () => {
    if (!lockInfo.isOwnLock) {
      const success = await acquireLock();
      if (!success) {
        setSnackbar({
          open: true,
          message: 'Sperre konnte nicht erworben werden - Mitarbeiter wird von einem anderen Benutzer bearbeitet',
          severity: 'error'
        });
        return false;
      }
    }
    return true;
  }, [lockInfo.isOwnLock, acquireLock]);

  // Snackbar State
  const [snackbar, setSnackbar] = useState<{ open: boolean, message: string, severity: 'success'|'error' }>({ open: false, message: '', severity: 'success' });

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

  // Manuelle Sperre freigeben mit Benachrichtigung
  const handleReleaseLock = async () => {
    try {
      // Sperre freigeben
      const success = await releaseLock();
      
      if (success) {
        setSnackbar({
          open: true,
          message: 'Sperre erfolgreich freigegeben - Weiterleitung zur Mitarbeiter-Seite',
          severity: 'success'
        });
        
        // Kurze Verzögerung für die Freigabe
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Nach Verzögerung zur Mitarbeiter-Seite navigieren
        router.push('/mitarbeiter');
      } else {
        setSnackbar({
          open: true,
          message: 'Fehler beim Freigeben der Sperre',
          severity: 'error'
        });
      }
    } catch (error) {
      console.error('Fehler beim Freigeben der Sperre:', error);
      setSnackbar({
        open: true,
        message: 'Fehler beim Freigeben der Sperre',
        severity: 'error'
      });
    }
  };

  // Debug-Logging für employee-Daten
  React.useEffect(() => {
    console.log('Mitarbeiterdetailseite - employee:', employee);
    console.log('Mitarbeiterdetailseite - employee.vacationDays:', employee?.vacationDays);
  }, [employee]);

  // Hinweis: Keine automatische Status-Überschreibung beim Seitenaufruf.
  // VacationCard ruft bei Änderungen selbst updateEmployeeStatusBasedOnVacation auf.

  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [editedEmployee, setEditedEmployee] = React.useState({
    name: '',
    position: '',
    email: '',
    phone: '',
    status: 'aktiv' as EmployeeStatus,
    elbaId: '',
    address: '',
    postalCode: '',
    city: ''
  });
  const [success, setSuccess] = React.useState(false);
  const [selectedPositions, setSelectedPositions] = React.useState<string[]>([]);
  const [filteredAssignments, setFilteredAssignments] = React.useState<any[]>([]);
  const [searchTerm, setSearchTerm] = React.useState<string>('');
  const [filterResetKey, setFilterResetKey] = React.useState<number>(0);

  const positionOptions = [
    'Bahnerder',
    'BüP',
    'HFE',
    'HiBa',
    'Monteur/Bediener',
    'Sakra',
    'SAS',
    'SIPO'
  ];

  useEffect(() => {
    if (employee) {
      setSelectedPositions(employee.position ? employee.position.split(',').map(p => p.trim()) : []);
    }
  }, [employee]);

  const handlePositionToggle = (position: string) => {
    setSelectedPositions(prev =>
      prev.includes(position)
        ? prev.filter(p => p !== position)
        : [...prev, position]
    );
  };

  // Callback für Filter-Änderungen
  const handleFilterChange = React.useCallback((newFilteredAssignments: any[]) => {
    setFilteredAssignments(newFilteredAssignments);
  }, []);

  // Freitextsuche auf Einsätzen anwenden
  const applySearch = React.useCallback((assignments: any[], term: string) => {
    const t = term.trim().toLowerCase();
    if (!t) return assignments;
    return assignments.filter((a) => {
      const fields = [
        a.projektName,
        a.funktion,
        Array.isArray(a.fahrzeuge) ? a.fahrzeuge.join(', ') : '',
        a.stunden?.toString?.() ?? '',
        a.fahrtstunden?.toString?.() ?? '',
        // Datum als dd.MM.yyyy und ISO vergleichen
        (() => {
          try { return format(new Date(a.datum), 'dd.MM.yyyy', { locale: de }); } catch { return ''; }
        })(),
        a.datum ?? ''
      ]
        .filter(Boolean)
        .map((v: string) => v.toString().toLowerCase());
      return fields.some((v: string) => v.includes(t));
    });
  }, []);

  // Sammle alle Einsätze des Mitarbeiters aus allen Projekten
  const employeeAssignments = React.useMemo(() => {
    if (!employee || !projectsLoaded || !projects) return [];
    
    return projects.flatMap(project => {
      return Object.entries(project.mitarbeiterZeiten || {})
        .flatMap(([date, entries]) =>
          (entries as any[])
            .filter(entry => entry.name === employee.name)
            .map(entry => {
              // Sammle Fahrzeuge für diesen Tag und Mitarbeiter
              const vehiclesForDay = project.fahrzeuge?.[date] || [];
              const vehicleNames = vehiclesForDay.map((v: any) => `${v.type} (${v.licensePlate})`);
              
              return {
                id: `${project.id}-${date}-${entry.id || Math.random()}`,
                projektName: project.name,
                datum: date,
                stunden: entry.stunden,
                fahrtstunden: entry.fahrtstunden || 0,
                funktion: entry.funktion,
                fahrzeuge: vehicleNames
              };
            })
        );
    }).sort((a, b) => new Date(b.datum).getTime() - new Date(a.datum).getTime());
  }, [projects, employee?.name, projectsLoaded]);

  // Berechne die Gesamtstunden basierend auf gefilterten Einsätzen
  const assignmentsToUse = React.useMemo(() => {
    const base = filteredAssignments.length > 0 ? filteredAssignments : employeeAssignments;
    return applySearch(base, searchTerm);
  }, [filteredAssignments, employeeAssignments, applySearch, searchTerm]);

  const totalHours = React.useMemo(() => {
    return assignmentsToUse.reduce((sum, einsatz) => sum + einsatz.stunden, 0);
  }, [assignmentsToUse]);

  const totalTravelHours = React.useMemo(() => {
    return assignmentsToUse.reduce((sum, einsatz) => sum + einsatz.fahrtstunden, 0);
  }, [assignmentsToUse]);

  if (!employee) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
            Mitarbeiter nicht gefunden
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Der angeforderte Mitarbeiter konnte nicht gefunden werden.
          </p>
        </div>
      </div>
    );
  }

  // Fehlerbehandlung für Projekte
  if (projectsError) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
            Fehler beim Laden der Projekte
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mb-4">
            {projectsError}
          </p>
          <Button onClick={() => window.location.reload()} variant="outline">
            Seite neu laden
          </Button>
        </div>
      </div>
    );
  }

  const handleEditClick = async () => {
    if (!employee) return;
    
    // Sperre erwerben bevor Bearbeitung
    const lockAcquired = await acquireLockOnDemand();
    if (!lockAcquired) {
      return;
    }
    
    setEditedEmployee({
      name: employee.name,
      position: employee.position || '',
      email: employee.email || '',
      phone: employee.phone || '',
      status: employee.status || 'aktiv',
      elbaId: employee.elbaId || '',
      address: employee.address || '',
      postalCode: employee.postalCode || '',
      city: employee.city || ''
    });
    setSelectedPositions(employee.position ? employee.position.split(',').map(p => p.trim()) : []);
    setIsEditDialogOpen(true);
  };

  const handleInputChange = (field: keyof typeof editedEmployee, value: string) => {
    setEditedEmployee(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {};

  const handleDelete = async () => {
    // Strenge Sperrprüfung vor Löschung
    if (!checkEditPermission()) {
      return;
    }

    // Sperre bei Bedarf erwerben
    if (!lockInfo.isOwnLock) {
      const lockAcquired = await acquireLockOnDemand();
      if (!lockAcquired) {
        return;
      }
    }

    if (employee) {
      deleteEmployee(employee.id);
      router.push('/mitarbeiter');
    }
  };

  const handleStatusChange = async (newStatus: EmployeeStatus) => {
    // Strenge Sperrprüfung vor Status-Änderung
    if (!checkEditPermission()) {
      return;
    }

    // Sperre bei Bedarf erwerben
    if (!lockInfo.isOwnLock) {
      const lockAcquired = await acquireLockOnDemand();
      if (!lockAcquired) {
        return;
      }
    }

    if (employee) {
      try {
        await setEmployeeStatus(employee.id, newStatus as EmployeeStatus);
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
    }
  };

  const handleExportPDF = async () => {
    // Sperrprüfung vor PDF-Export
    if (lockInfo.isLocked && !lockInfo.isOwnLock) {
      setSnackbar({
        open: true,
        message: 'PDF-Export nicht möglich - Mitarbeiter wird von einem anderen Benutzer bearbeitet',
        severity: 'error'
      });
      return;
    }

    // Sperre bei Bedarf erwerben
    if (!lockInfo.isOwnLock) {
      const lockAcquired = await acquireLockOnDemand();
      if (!lockAcquired) {
        return;
      }
    }

    const doc = new jsPDF();
    const timestamp = new Date().toLocaleString('de-DE');
    doc.setFontSize(20);
    doc.text('Mitarbeiterdetails', 14, 20);
    doc.setFontSize(12);
    doc.text(`Exportiert am: ${timestamp}`, 14, 30);
    
    // Filter-Information hinzufügen, wenn Filter aktiv sind
    let filterInfo = '';
    if (filteredAssignments.length > 0 && filteredAssignments.length !== employeeAssignments.length) {
      filterInfo = `Gefilterte Einsätze: ${filteredAssignments.length} von ${employeeAssignments.length} Einsätzen`;
    }
    
    if (filterInfo) {
      doc.setFontSize(10);
      doc.text(filterInfo, 14, 40);
    }
    
    doc.setFontSize(14);
    doc.text('Mitarbeiterinformationen', 14, filterInfo ? 50 : 40);
    doc.setFontSize(11);
    let y = filterInfo ? 58 : 48;
    doc.text(`Name: ${employee.name}`, 14, y); y += 7;
    doc.text(`Mitarbeiter-Nr.: ${employee.miNumber ? `MI-${String(employee.miNumber).padStart(3, '0')}` : '-'}`, 14, y); y += 7;
    doc.text(`Position(en): ${employee.position || '-'}`, 14, y); y += 7;
    doc.text(`Status: ${employee.status || 'aktiv'}`, 14, y); y += 7;
    doc.text(`Telefon: ${employee.phone || '-'}`, 14, y); y += 7;
    doc.text(`E-Mail: ${employee.email || '-'}`, 14, y); y += 7;
    doc.text(`ElBa ID-Nr.: ${employee.elbaId || '-'}`, 14, y); y += 7;
    doc.text(`Anschrift: ${employee.address || '-'}`, 14, y); y += 7;
    doc.text(`PLZ: ${employee.postalCode || '-'}`, 14, y); y += 7;
    doc.text(`Stadt: ${employee.city || '-'}`, 14, y); y += 7;
    doc.text(`Anzahl Einsätze: ${assignmentsToUse.length}`, 14, y); y += 7;
    doc.text(`Gesamtstunden: ${totalHours.toFixed(1)}h`, 14, y); y += 7;
    doc.text(`Gesamtfahrstunden: ${totalTravelHours.toFixed(1)}h`, 14, y); y += 7;

    // Urlaubstabelle
    if (employee.vacationDays && employee.vacationDays.length > 0) {
      doc.setFontSize(14);
      doc.text('Urlaub', 14, y + 6);
      const startY = y + 12;
      const vacationRows = employee.vacationDays.map((v) => {
        const start = new Date(v.startDate);
        const end = new Date(v.endDate);
        const days = differenceInCalendarDays(end, start) + 1;
        return [
          format(start, 'dd.MM.yyyy', { locale: de }),
          format(end, 'dd.MM.yyyy', { locale: de }),
          `${days} Tage`,
        ];
      });

      autoTable(doc, {
        head: [['Start', 'Ende', 'Dauer']],
        body: vacationRows,
        startY,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [59, 130, 246], textColor: 255 },
      });
      const afterTableY = (doc as any).lastAutoTable?.finalY || startY;
      y = afterTableY + 10;
    } else {
      doc.setFontSize(12);
      doc.text('Urlaub: Keine Einträge', 14, y); y += 7;
    }
    
    // Einsätze-Tabelle
    if (assignmentsToUse.length > 0) {
      doc.addPage();
      doc.setFontSize(16);
      doc.text('Einsätze', 14, 20);
      doc.setFontSize(10);
      
      const tableData = assignmentsToUse.map(assignment => [
        assignment.projektName || '-',
        format(new Date(assignment.datum), 'dd.MM.yyyy', { locale: de }),
        assignment.stunden ? `${assignment.stunden.toFixed(1)}h` : '-',
        assignment.fahrtstunden ? `${assignment.fahrtstunden.toFixed(1)}h` : '-',
        assignment.funktion || '-'
      ]);
      
      autoTable(doc, {
        head: [['Projekt', 'Datum', 'Arbeitsstunden', 'Fahrstunden', 'Funktion']],
        body: tableData,
        startY: 30,
        styles: {
          fontSize: 8,
          cellPadding: 2
        },
        headStyles: {
          fillColor: [59, 130, 246],
          textColor: 255
        }
      });
    }
    
    doc.save(`mitarbeiter-${employee.name.replace(/\s+/g, '_')}.pdf`);
    
    setSnackbar({
      open: true,
      message: 'PDF erfolgreich exportiert',
      severity: 'success'
    });
  };

  const isCurrentlyOnVacation = (emp: Employee) => {
    if (!emp.vacationDays || emp.vacationDays.length === 0) {
      return false;
    }
    const today = new Date();
    const isVacationToday = emp.vacationDays.some(vacation => {
      const start = new Date(vacation.startDate);
      const end = new Date(vacation.endDate);
      return today >= start && today <= end;
    });
    return isVacationToday;
  };

  return (
    <div className="p-4 bg-white dark:bg-slate-900 min-h-screen employee-detail-page">
      {/* Locking-Status Anzeige */}
      {lockInfo.isLocked && (
        <div className="mb-4">
          {lockInfo.isOwnLock ? (
            <Alert className="border-green-200 bg-green-50 dark:bg-green-900/20">
              <Lock className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800 dark:text-green-200">
                Sie bearbeiten diesen Mitarbeiter. Sperre wird automatisch nach 30 Minuten Inaktivität freigegeben.
              </AlertDescription>
            </Alert>
          ) : (
            <Alert className="border-orange-200 bg-orange-50 dark:bg-orange-900/20">
              <Lock className="h-4 w-4 text-orange-600" />
              <AlertDescription className="text-orange-800 dark:text-orange-200">
                Dieser Mitarbeiter wird von {lockInfo.lockedBy?.name} bearbeitet. Sie können nur lesen.
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : !employee ? (
        <div className="text-center py-12">
          <p className="text-slate-600 dark:text-slate-400">Mitarbeiter nicht gefunden</p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-[#114F6B] dark:text-white">{employee.name}</h1>
              <p className="text-slate-600 dark:text-slate-400 mt-1">Mitarbeiterdetails</p>
            </div>
            <div className="flex gap-2">
              {lockInfo.isOwnLock && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleReleaseLock}
                  className="flex items-center gap-2 bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
                >
                  <Unlock className="h-4 w-4" />
                  Sperre freigeben
                </Button>
              )}
              {!lockInfo.isOwnLock && lockInfo.isLocked && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={acquireLock}
                  className="flex items-center gap-2 bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100"
                >
                  <Lock className="h-4 w-4" />
                  Sperre erwerben
                </Button>
              )}
              <Button 
                variant="outline" 
                onClick={handleExportPDF}
                disabled={lockInfo.isLocked && !lockInfo.isOwnLock}
                className={lockInfo.isLocked && !lockInfo.isOwnLock ? 'opacity-50 cursor-not-allowed' : ''}
              >
                <Download className="mr-2 h-4 w-4" />
                PDF Export
              </Button>
              <Button 
                variant="outline" 
                onClick={handleEditClick}
                disabled={lockInfo.isLocked && !lockInfo.isOwnLock}
                className={lockInfo.isLocked && !lockInfo.isOwnLock ? 'opacity-50 cursor-not-allowed' : ''}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Bearbeiten
              </Button>
              <Button 
                variant="destructive" 
                onClick={() => setIsDeleteDialogOpen(true)}
                disabled={lockInfo.isLocked && !lockInfo.isOwnLock}
                className={lockInfo.isLocked && !lockInfo.isOwnLock ? 'opacity-50 cursor-not-allowed' : ''}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Löschen
              </Button>
            </div>
          </div>
          <Button 
            className="flex items-center gap-2 bg-slate-600 hover:bg-slate-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 mb-6"
            size="sm" 
            onClick={() => router.push('/mitarbeiter')}
          >
            <ArrowLeft className="h-4 w-4" />
            Zurück zu allen Mitarbeitern
          </Button>
          <div className="space-y-6">
            <Card className="border-0 shadow-lg bg-white dark:bg-slate-800 rounded-xl employee-info-card">
              <CardHeader>
                <h2 className="text-xl font-semibold text-[#114F6B] dark:text-white">Mitarbeiterinformationen</h2>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm text-gray-600 dark:text-slate-400">Name</Label>
                    <p className="font-medium dark:text-white">{employee.name}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-gray-600 dark:text-slate-400">Mitarbeiter-Nr.</Label>
                    <p className="font-medium dark:text-white">{employee.miNumber ? `MI-${String(employee.miNumber).padStart(3, '0')}` : '-'}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-gray-600 dark:text-slate-400">Position(en)</Label>
                    <p className="font-medium dark:text-white">{employee.position || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-gray-600 dark:text-slate-400">Status</Label>
                    <div className="mt-1">
                        <EmployeeStatusSelect
                          employee={employee}
                          currentStatus={employee.status || 'aktiv'}
                          onStatusChange={async (_employeeId: string, newStatus: EmployeeStatus) => handleStatusChange(newStatus)}
                          isCurrentlyOnVacation={isCurrentlyOnVacation(employee)}
                          disabled={lockInfo.isLocked && !lockInfo.isOwnLock}
                        />
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm text-gray-600 dark:text-slate-400">E-Mail</Label>
                    <p className="font-medium dark:text-white">{employee.email || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-gray-600 dark:text-slate-400">Telefon</Label>
                    <p className="font-medium dark:text-white">{employee.phone || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-gray-600 dark:text-slate-400">ElBa ID-Nr.</Label>
                    <p className="font-medium dark:text-white">{employee.elbaId || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-gray-600 dark:text-slate-400">Anschrift</Label>
                    <p className="font-medium dark:text-white">{employee.address || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-gray-600 dark:text-slate-400">PLZ</Label>
                    <p className="font-medium dark:text-white">{employee.postalCode || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-gray-600 dark:text-slate-400">Stadt</Label>
                    <p className="font-medium dark:text-white">{employee.city || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-gray-600 dark:text-slate-400">Gesamtarbeitsstunden</Label>
                    <p className="font-medium dark:text-white">{totalHours.toFixed(1)}h</p>
                  </div>
                  <div>
                    <Label className="text-sm text-gray-600 dark:text-slate-400">Gesamtfahrstunden</Label>
                    <p className="font-medium dark:text-white">{totalTravelHours.toFixed(1)}h</p>
                  </div>
                  <div>
                    <Label className="text-sm text-gray-600 dark:text-slate-400">Anzahl Einsätze</Label>
                    <p className="font-medium dark:text-white">{employeeAssignments.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* VacationCard hinzufügen */}
            {employee && (
              <VacationCard 
                employee={employee} 
                onVacationChange={(isOnVacation) => {
                  // Hier können wir später Logik für die Projektvergabe hinzufügen
                  console.log(`Mitarbeiter ${employee.name} ist ${isOnVacation ? 'im Urlaub' : 'verfügbar'}`);
                }}
              />
            )}
            
            <Card className="border-0 shadow-lg bg-white dark:bg-slate-800 rounded-xl">
              <CardHeader>
                <h2 className="text-xl font-semibold text-[#114F6B] dark:text-white">Einsätze</h2>
              </CardHeader>
              <CardContent>
                {/* Einfache Freitextsuche */}
                <EmployeeFilter
                  searchTerm={searchTerm}
                  onSearchChange={setSearchTerm}
                  onClearFilters={() => {
                    setSearchTerm('');
                    setFilteredAssignments([]);
                    setFilterResetKey((k) => k + 1);
                  }}
                />
                {/* Filter-Komponente */}
                <EmployeeAssignmentFilter
                  key={filterResetKey}
                  assignments={employeeAssignments}
                  onFilterChange={handleFilterChange}
                />
                
                <div className="rounded-xl border border-slate-200 dark:border-slate-600 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50 dark:bg-slate-700">
                        <TableHead className="font-medium text-slate-700 dark:text-slate-300">Datum</TableHead>
                        <TableHead className="font-medium text-slate-700 dark:text-slate-300">Projekt</TableHead>
                        <TableHead className="font-medium text-slate-700 dark:text-slate-300">Funktion</TableHead>
                        <TableHead className="font-medium text-slate-700 dark:text-slate-300">Arbeitsstunden</TableHead>
                        <TableHead className="font-medium text-slate-700 dark:text-slate-300">Fahrstunden</TableHead>
                        <TableHead className="font-medium text-slate-700 dark:text-slate-300">Fahrzeug(e)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {assignmentsToUse.map((einsatz) => {
                        return (
                          <TableRow key={einsatz.id} className="hover:bg-slate-50 dark:hover:bg-slate-700">
                            <TableCell className="dark:text-white">{format(new Date(einsatz.datum), 'dd.MM.yyyy', { locale: de })}</TableCell>
                            <TableCell className="dark:text-white">{einsatz.projektName}</TableCell>
                            <TableCell>
                              {einsatz.funktion ? (
                                <Badge variant="secondary" className="rounded-lg dark:bg-slate-700 dark:text-slate-300">{einsatz.funktion}</Badge>
                              ) : (
                                <span className="text-slate-400 dark:text-slate-500">-</span>
                              )}
                            </TableCell>
                            <TableCell className="dark:text-white">{einsatz.stunden.toFixed(1)}h</TableCell>
                            <TableCell className="dark:text-white">{einsatz.fahrtstunden.toFixed(1)}h</TableCell>
                            <TableCell>
                              {einsatz.fahrzeuge.length > 0
                                ? einsatz.fahrzeuge.join(', ')
                                : <span className="text-slate-400 dark:text-slate-500">-</span>}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* Bearbeiten-Dialog */}
      <EditEmployeeDialog
        employee={employee}
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        onEmployeeUpdated={async () => {
          // Nach erfolgreichem Update im Dialog: Frische Daten vom Server holen und lokalen Zustand setzen
          try {
            const res = await fetch(`/api/employees/${employee.id}`, { credentials: 'include' });
            if (res.ok) {
              const json = await res.json();
              if (json && json.employee) {
                await updateEmployee(employee.id, json.employee);
              }
            }
            setSnackbar({ open: true, message: 'Mitarbeiter erfolgreich aktualisiert', severity: 'success' })
          } catch (e) {
            setSnackbar({ open: true, message: 'Aktualisierte Daten konnten nicht geladen werden', severity: 'error' })
          }
        }}
      />

      {/* Löschen-Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogTitle>Mitarbeiter löschen</DialogTitle>
          <p>Möchten Sie den Mitarbeiter "{employee.name}" wirklich löschen?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Löschen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Resource Lock Dialog */}
      <ResourceLockDialog
        isOpen={lockInfo.isLocked && !lockInfo.isOwnLock}
        onClose={() => checkLock()}
        onRetry={async () => {
          console.log('Retry clicked - checking lock and attempting to acquire');
          await checkLock();
          const success = await acquireLock();
          if (success) {
            console.log('Lock acquired successfully - reloading page');
            window.location.reload();
          }
        }}
        lockInfo={lockInfo}
        resourceType="employee"
        resourceName={employee?.name}
        blockPage={true} // Seitenblockierung aktiviert
      />

      {/* Snackbar */}
      {snackbar.open && (
        <Alert className={`fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50 ${
          snackbar.severity === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
        }`}>
          <AlertDescription>{snackbar.message}</AlertDescription>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={closeSnackbar}
            className="ml-2 text-white hover:text-white/80"
          >
            ✕
          </Button>
        </Alert>
      )}
    </div>
  );
} 