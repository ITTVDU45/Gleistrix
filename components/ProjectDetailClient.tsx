'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from './ui/button';
import { fetchWithIntent } from '@/lib/http/fetchWithIntent';
import { ProjectsApi } from '@/lib/api/projects'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Table, TableBody, TableCell, TableHeader, TableHead, TableRow } from './ui/table';
import { Dialog, DialogContent, DialogTitle, DialogFooter } from './ui/dialog';
import { Alert, AlertDescription } from './ui/alert';
import { Badge } from './ui/badge';
import { useProjects } from '../hooks/useProjects';
import { useEmployees } from '../hooks/useEmployees';
import { useVehicles } from '../hooks/useVehicles';
import { useResourceLock } from '../hooks/useResourceLock';
import { ArrowLeft, Edit, Trash2, Plus, Lock, Unlock } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import TechnikList from './TechnikList';
import VehicleAssignmentList from './VehicleAssignmentList';
import { EditTimeEntryForm } from './EditTimeEntryForm';
import { TimeEntryForm } from './TimeEntryForm';
import { VehicleAssignmentForm } from './VehicleAssignmentForm';
import TechnikAssignmentForm from './TechnikAssignmentForm';
import EditTechnikDialog from './EditTechnikDialog';
import { ResourceLockDialog } from './ui/ResourceLockDialog';
import type { Project, TechnikEntry } from '../types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
// Replace Radix VisuallyHidden with a simple inline implementation to avoid extra dependency
const VisuallyHidden = ({ children }: { children: React.ReactNode }) => (
  <span style={{
    position: 'absolute',
    width: 1,
    height: 1,
    padding: 0,
    margin: -1,
    overflow: 'hidden',
    clip: 'rect(0, 0, 0, 0)',
    whiteSpace: 'nowrap',
    border: 0,
  }}>{children}</span>
);
import { ChartContainer } from './ui/chart';
import { ScrollArea } from './ui/scroll-area';
import { BarChart, Bar, XAxis, YAxis, Tooltip, LineChart, Line, CartesianGrid, ResponsiveContainer, Legend, AreaChart, Area, PieChart, Pie, Cell, LabelList } from 'recharts';
import Image from 'next/image';
import { ActivityLogApi } from '@/lib/api/activityLog'
import { useSession } from 'next-auth/react';

type ProjectDetailClientProps = {
  projectId: string;
};

export default function ProjectDetailClient({ projectId }: ProjectDetailClientProps) {
  // Hilfsfunktion zur Formatierung von Stunden in HH:MM Format
  const formatHours = (hours: number): string => {
    const wholeHours = Math.floor(hours);
    const minutes = Math.round((hours - wholeHours) * 60);
    return `${wholeHours}:${minutes.toString().padStart(2, '0')}`;
  };

  const router = useRouter();
  const id = projectId;
  const { projects, fetchProjects } = useProjects();
  const { employees } = useEmployees();
  const { vehicles } = useVehicles();
  const [project, setProject] = React.useState<Project | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const { data: session } = useSession();
  const userId = (session as any)?.user?.id as string | undefined;

  // Locking-System
  const {
    lockInfo,
    isLoading: lockLoading,
    error: lockError,
    acquireLock,
    releaseLock,
    checkLock
  } = useResourceLock({
    resourceType: 'project',
    resourceId: id,
    autoAcquire: false, // Automatische Sperrerwerbung DEAKTIVIERT - wir steuern das manuell
    autoRelease: true, // Auf Detailseite explizit beim Verlassen freigeben
    activityInterval: 30,
    checkInterval: 15,
    lazyLoad: false,
    userId,
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
        message: 'Sperre verloren - Projekt wird von einem anderen Benutzer bearbeitet',
        severity: 'error'
      });
    }
  });

  // Wenn Projekt von anderem Nutzer gesperrt: sofort zur Übersicht umleiten und Dialog dort zeigen
  React.useEffect(() => {
    if (id && lockInfo.isLocked && !lockInfo.isOwnLock) {
      router.replace(`/projekte?locked=${id}`);
    }
  }, [id, lockInfo.isLocked, lockInfo.isOwnLock, router]);

  // Hinweis: Freigabe auf der Detailseite erfolgt nur manuell (Button)
  // und durch beforeunload/pagehide in useResourceLock. Zusätzlich Cleanup beim Unmount,
  // falls pagehide in manchen Browsern nicht feuert (z.B. harter Navigationswechsel).
  React.useEffect(() => {
    return () => {
      if (lockInfo.isOwnLock) {
        navigator.sendBeacon('/api/locks/release', new Blob([JSON.stringify({ resourceType: 'project', resourceId: id })], { type: 'application/json' }));
      }
    };
  }, [id, lockInfo.isOwnLock]);

  // Einmaliger Versuch beim ersten Laden: Wenn frei, Sperre erwerben
  const initialAcquireTriedRef = React.useRef(false);
  React.useEffect(() => {
    const tryInitialAcquire = async () => {
      if (!id || initialAcquireTriedRef.current) return;
      initialAcquireTriedRef.current = true;
      const status = await checkLock(true);
      if (!status.isLocked || status.isOwnLock) {
        if (!status.isOwnLock) {
          await acquireLock();
        }
      } else {
        // Wenn gesperrt von anderem, umleiten (Absicherung zusätzlich zum separaten Redirect-Effekt)
        router.replace(`/projekte?locked=${id}`);
      }
    };
    tryInitialAcquire();
  }, [id, checkLock, acquireLock, router]);

  // Sperre bei Bedarf erwerben
  const acquireLockOnDemand = async () => {
    console.log('=== SPERRE BEI BEDARF ERWERBEN ===');
    console.log(`Aktueller Lock-Status: isOwnLock=${lockInfo.isOwnLock}, isLocked=${lockInfo.isLocked}`);
    
    if (lockInfo.isOwnLock) {
      console.log('Sperre bereits besessen');
      return true;
    }
    
    if (lockInfo.isLocked && !lockInfo.isOwnLock) {
      console.log('Sperre von anderem Benutzer - kann nicht erwerben');
      setSnackbar({
        open: true,
        message: 'Projekt wird von einem anderen Benutzer bearbeitet',
        severity: 'error'
      });
      return false;
    }
    
    console.log('Versuche Sperre zu erwerben...');
    const success = await acquireLock();
    
    if (success) {
      console.log('Sperre erfolgreich erworben');
      return true;
    } else {
      console.log('Sperre konnte nicht erworben werden');
      setSnackbar({
        open: true,
        message: 'Sperre konnte nicht erworben werden',
        severity: 'error'
      });
      return false;
    }
  };

  // Prüfen, ob Bearbeitung erlaubt ist
  const checkEditPermission = () => {
    console.log('=== BEARBEITUNGSBERECHTIGUNG PRÜFEN ===');
    console.log(`Lock-Status: isOwnLock=${lockInfo.isOwnLock}, isLocked=${lockInfo.isLocked}`);
    
    if (!lockInfo.isOwnLock) {
      console.log('Keine eigene Sperre - Bearbeitung nicht erlaubt');
      setSnackbar({
        open: true,
        message: 'Sie müssen zuerst die Sperre erwerben',
        severity: 'error'
      });
      return false;
    }
    
    console.log('Bearbeitung erlaubt');
    return true;
  };

  // Dialog-States für Technik, Zeiten, Fahrzeuge
  const [technikDialogOpen, setTechnikDialogOpen] = React.useState(false);
  const [zeitDialogOpen, setZeitDialogOpen] = React.useState(false);
  const [fahrzeugDialogOpen, setFahrzeugDialogOpen] = React.useState(false);
  const [exportDialogOpen, setExportDialogOpen] = React.useState(false);
  const [isExporting, setIsExporting] = React.useState(false);
  const [exportSelectedDays, setExportSelectedDays] = React.useState<string[]>([]);

  // Snackbar State
  const [snackbar, setSnackbar] = React.useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'warning' | 'info';
  }>({
    open: false,
    message: '',
    severity: 'success'
  });

  // Debug: Lock-Status anzeigen
  React.useEffect(() => {
    console.log('=== DEBUG: LOCK STATUS UPDATE ===');
    console.log('lockInfo:', lockInfo);
    console.log('snackbar:', snackbar);
  }, [lockInfo, snackbar]);

  // Dialog-States für Technik, Zeiten, Fahrzeuge
  const [exportDayDialogOpen, setExportDayDialogOpen] = React.useState(false);
  const [selectedTechnikTag, setSelectedTechnikTag] = React.useState<string>('');
  const [selectedZeitTag, setSelectedZeitTag] = React.useState<string>('');
  const [selectedFahrzeugTag, setSelectedFahrzeugTag] = React.useState<string>('');

  // State für Dialoge und Snackbar
  const [statusUpdating, setStatusUpdating] = React.useState(false);

  const statusOptions = [
    { value: 'aktiv', label: 'Aktiv', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
    { value: 'abgeschlossen', label: 'Abgeschlossen', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
    { value: 'fertiggestellt', label: 'Fertiggestellt', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400' },
    { value: 'geleistet', label: 'Geleistet', color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400' },
    { value: 'kein Status', label: 'Kein Status', color: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400' }
  ];

  // Snackbar schließen
  const closeSnackbar = () => {
    setSnackbar({ open: false, message: '', severity: 'success' });
  };

  // Snackbar automatisch schließen
  React.useEffect(() => {
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
      console.log('=== SPERRE FREIGEBEN VERSUCH ===');
      console.log(`Ressource: project/${id}`);
      
      // Sperre freigeben
      const success = await releaseLock();
      
      console.log('Release result:', success);
      
      if (success) {
        setSnackbar({
          open: true,
          message: 'Sperre erfolgreich freigegeben - Weiterleitung zur Projektseite',
          severity: 'success'
        });
        
        // Längere Verzögerung für die Freigabe (3 Sekunden)
        console.log('Waiting 3 seconds for lock release to propagate...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        console.log('Navigating to project overview...');
        // Nach Verzögerung zur Projektseite navigieren
        router.push('/projekte');
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

  React.useEffect(() => {
    if (!id) return;
    const found = projects.find((p) => p.id === id);
    if (found) {
      setProject(found);
      setError(null);
    } else {
      setProject(null);
      setError('Projekt nicht gefunden');
    }
  }, [id, projects]);

  // Hilfsfunktion: Alle Tage des Projekts als Array
  function getProjectDays(): string[] {
    if (!project) return [];
    const start = new Date(project.datumBeginn || new Date().toISOString());
    const end = new Date(project.datumEnde || project.datumBeginn || new Date().toISOString());
    const days: string[] = [];
    let current = new Date(start);
    while (current <= end) {
      days.push(format(current, 'yyyy-MM-dd'));
      current.setDate(current.getDate() + 1);
    }
    return days;
  }

  const projectDays = getProjectDays();

  // Hilfsfunktion: Prüft, ob bereits Zeiteinträge vorhanden sind
  function hasExistingTimeEntries(): boolean {
    if (!project || !project.mitarbeiterZeiten) return false;
    
    // Prüfe, ob es mindestens einen Tag mit Zeiteinträgen gibt
    return Object.keys(project.mitarbeiterZeiten).some(day => {
      const entries = project.mitarbeiterZeiten[day];
      return entries && entries.length > 0;
    });
  }

  React.useEffect(() => {
    if (project) {
      const days = getProjectDays();
      if (days.length > 0) {
        if (!selectedTechnikTag) setSelectedTechnikTag(days[0]);
        if (!selectedZeitTag) setSelectedZeitTag(days[0]);
        if (!selectedFahrzeugTag) setSelectedFahrzeugTag(days[0]);
      }
    }
    // eslint-disable-next-line
  }, [project]);

  // Handler für Technik - Hinzufügen
  const handleAddTechnik = async (date: string | string[], technik: { name: string; anzahl: number; meterlaenge: number }) => {
    if (!project) return;

    // Sperre bei Bedarf erwerben
    if (!lockInfo.isOwnLock) {
      const lockAcquired = await acquireLockOnDemand();
      if (!lockAcquired) {
        return;
      }
    }

    // Prüfen, ob das Projekt gesperrt ist
    if (!checkEditPermission()) {
      return;
    }

    try {
      if (!project) throw new Error('Projekt nicht geladen');
      const isBatch = Array.isArray(date);
      const payload = isBatch
        ? { technik: { action: 'add', dates: date, technik } }
        : { technik: { action: 'add', date, technik } };
      const response = await ProjectsApi.update(project.id, payload as any)
      if ((response as any).success !== false) {
        await fetchProjects();
        setSnackbar({
          open: true,
          message: 'Technik erfolgreich hinzugefügt',
          severity: 'success'
        });
      } else {
        throw new Error('Fehler beim Hinzufügen der Technik');
      }
    } catch (error) {
      console.error('Fehler beim Hinzufügen der Technik:', error);
      setSnackbar({
        open: true,
        message: 'Fehler beim Hinzufügen der Technik',
        severity: 'error'
      });
    }
  };

  // Technik bearbeiten (PUT)
  const handleEditTechnik = async (date: string, technik: any) => {
    // Sperre bei Bedarf erwerben
    if (!lockInfo.isOwnLock) {
      const lockAcquired = await acquireLockOnDemand();
      if (!lockAcquired) {
        return;
      }
    }

    // Prüfen, ob das Projekt gesperrt ist
    if (!checkEditPermission()) {
      return;
    }

    try {
      console.log('handleEditTechnik called with:', { date, technik });
      
      const requestBody: any = { 
        date, 
        technikId: technik.id, 
        updatedTechnik: {
          name: technik.name,
          anzahl: technik.anzahl,
          meterlaenge: technik.meterlaenge,
          bemerkung: technik.bemerkung || ''
        }
      };

      // Wenn selectedDays vorhanden sind, füge sie zum Request hinzu
      if (technik.selectedDays && Array.isArray(technik.selectedDays)) {
        requestBody.selectedDays = technik.selectedDays;
        console.log('Sending request with selectedDays:', technik.selectedDays);
      }

      console.log('Sending request body:', requestBody);

      const result = await ProjectsApi.update(id, { technik: { action: 'edit', ...requestBody } } as any)
      console.log('API Response:', result);
      
      if ((result as any).project) {
        console.log('Updating project with:', (result as any).project);
        setProject((result as any).project as any);
        
        setSnackbar({
          open: true,
          message: 'Technik erfolgreich bearbeitet',
          severity: 'success'
        });
      } else {
        // Fallback: Projekte neu laden
        await fetchProjects();
        setSnackbar({
          open: true,
          message: 'Technik erfolgreich bearbeitet',
          severity: 'success'
        });
      }
      
      setTechnikDialogOpen(false);
    } catch (error) {
      console.error('Fehler beim Bearbeiten der Technik:', error);
      setSnackbar({
        open: true,
        message: 'Fehler beim Bearbeiten der Technik',
        severity: 'error'
      });
    }
  };

  // Technik entfernen
  const handleRemoveTechnik = async (date: string, technikId: string) => {
    // Sperre bei Bedarf erwerben
    if (!lockInfo.isOwnLock) {
      const lockAcquired = await acquireLockOnDemand();
      if (!lockAcquired) {
        return;
      }
    }

    // Prüfen, ob das Projekt gesperrt ist
    if (!checkEditPermission()) {
      return;
    }

    try {
      if (!project) throw new Error('Projekt nicht geladen');
      const response = await ProjectsApi.update(project.id, { technik: { action: 'remove', date, technikId } } as any)
      if ((response as any).success !== false) {
        await fetchProjects();
        setSnackbar({
          open: true,
          message: 'Technik erfolgreich entfernt',
          severity: 'success'
        });
      } else {
        throw new Error('Fehler beim Entfernen der Technik');
      }
    } catch (error) {
      console.error('Fehler beim Entfernen der Technik:', error);
      setSnackbar({
        open: true,
        message: 'Fehler beim Entfernen der Technik',
        severity: 'error'
      });
    }
  };

  // Wrapper für TechnikAssignmentForm - für mehrere Tage
  const handleAssignTechnikMultiple = async (dateOrDates: string | string[], technik: { name: string; anzahl: number; meterlaenge: number; selectedDays?: string[] }) => {
    try {
      // Nur die im Formular gewählten Tage verwenden; wenn leer, dann nichts tun
      const selected = Array.isArray(dateOrDates) ? dateOrDates : (technik.selectedDays || []);
      if (!Array.isArray(selected) || selected.length === 0) {
        setSnackbar({ open: true, message: 'Bitte wählen Sie mindestens einen Tag aus.', severity: 'error' });
        return;
      }

      await handleAddTechnik(selected, technik);
      // Nach Abschluss neu laden
      await fetchProjects();
      
      // Kurze Verzögerung um sicherzustellen, dass die Daten aktualisiert sind
      setTimeout(async () => {
        await fetchProjects();
        const updatedProject = projects.find((p) => p.id === id);
        if (updatedProject) setProject(updatedProject);
      }, 500);
      
    } catch (err) {
      setSnackbar({ open: true, message: 'Fehler beim Hinzufügen der Technik.', severity: 'error' });
    }
  };

  // Hilfsfunktion: Technik-Statistiken berechnen
  const getTechnikStats = () => {
    if (!project?.technik) return { atwsImEinsatz: false, anzahlAtws: 0, gesamtMeterlaenge: 0 };
    
    let allTechnik: any[] = [];
    
    if (typeof project.technik === 'object') {
      // Mixed-Type Schema - direkt Objekt-Struktur
      allTechnik = Object.values(project.technik)
        .filter(item => item !== null && Array.isArray(item))
        .flat()
        .filter(item => item && typeof item === 'object');
    }
    
    console.log('Technik Stats Debug:', {
      projectId: project.id,
      technikType: typeof project.technik,
      allTechnik,
      technikKeys: project.technik ? Object.keys(project.technik) : []
    });
    
    const atwsImEinsatz = allTechnik.length > 0;
    const anzahlAtws = allTechnik.reduce((sum: number, t: any) => sum + (t.anzahl || 0), 0);
    const gesamtMeterlaenge = allTechnik.reduce((sum: number, t: any) => sum + (t.meterlaenge || 0), 0);
    
    return { atwsImEinsatz, anzahlAtws, gesamtMeterlaenge };
  };

  const technikStats = getTechnikStats();

  // Handler für Zeiteinträge - Hinzufügen
  const handleAddTimeEntry = async (dates: string[] | string, entry: any) => {
    // Sperre bei Bedarf erwerben
    if (!lockInfo.isOwnLock) {
      const lockAcquired = await acquireLockOnDemand();
      if (!lockAcquired) {
        return;
      }
    }

    // Prüfen, ob das Projekt gesperrt ist
    if (!checkEditPermission()) {
      return;
    }

    try {
      if (!project) throw new Error('Projekt nicht geladen');
      const response = await ProjectsApi.update(project.id, { times: { action: 'add', dates: Array.isArray(dates) ? dates : [dates], entry } } as any)
      if ((response as any).success !== false) {
        await fetchProjects();
        setSnackbar({
          open: true,
          message: 'Zeiteintrag erfolgreich hinzugefügt',
          severity: 'success'
        });
        setZeitDialogOpen(false);
      } else {
        throw new Error('Fehler beim Hinzufügen des Zeiteintrags');
      }
    } catch (error) {
      console.error('Fehler beim Hinzufügen des Zeiteintrags:', error);
      setSnackbar({
        open: true,
        message: 'Fehler beim Hinzufügen des Zeiteintrags',
        severity: 'error'
      });
    }
  };

  // Handler für Fahrzeuge - Hinzufügen
  const handleAddVehicle = async (dateOrDays: string | string[], vehicle: any): Promise<void> => {
    // Sperre bei Bedarf erwerben
    if (!lockInfo.isOwnLock) {
      const lockAcquired = await acquireLockOnDemand();
      if (!lockAcquired) {
        return;
      }
    }

    // Prüfen, ob das Projekt gesperrt ist
    if (!checkEditPermission()) {
      return;
    }

    try {
      if (!project) throw new Error('Projekt nicht geladen');
      const response = await ProjectsApi.update(project.id, { vehicles: { action: 'assign', dates: Array.isArray(dateOrDays) ? dateOrDays : [dateOrDays], vehicle } } as any)
      if ((response as any).success !== false) {
        await fetchProjects();
        setSnackbar({
          open: true,
          message: 'Fahrzeug erfolgreich hinzugefügt',
          severity: 'success'
        });
        setFahrzeugDialogOpen(false);
      } else {
        throw new Error('Fehler beim Hinzufügen des Fahrzeugs');
      }
    } catch (error) {
      console.error('Fehler beim Hinzufügen des Fahrzeugs:', error);
      setSnackbar({
        open: true,
        message: 'Fehler beim Hinzufügen des Fahrzeugs',
        severity: 'error'
      });
    }
  };

  // Status ändern
  const handleStatusChange = async (newStatus: string) => {
    // Sperre bei Bedarf erwerben
    if (!lockInfo.isOwnLock) {
      const lockAcquired = await acquireLockOnDemand();
      if (!lockAcquired) {
        return;
      }
    }

    // Prüfen, ob das Projekt gesperrt ist
    if (!checkEditPermission()) {
      return;
    }

    try {
      if (!project) throw new Error('Projekt nicht geladen');
      const previousStatus = project.status;
      const response = await ProjectsApi.updateStatus(project.id, newStatus)
      if ((response as any).success !== false) {
        await fetchProjects();
        setSnackbar({
          open: true,
          message: newStatus === 'geleistet' ? 'Status geändert: „geleistet“. Projektinformationen werden per E-Mail versendet.' : `Status erfolgreich auf "${newStatus}" geändert`,
          severity: 'success'
        });

        // Aktivität loggen (nicht-blockierend)
        try {
          await ActivityLogApi.create({
            actionType: 'project_status_changed',
            module: 'project',
            details: {
              description: `Projektstatus geändert: ${project?.name ?? id} (${previousStatus} → ${newStatus})`,
              entityId: id,
              entityName: project?.name,
              before: { status: previousStatus },
              after: { status: newStatus },
              context: { source: 'detail_view' }
            }
          } as any)
        } catch (e) {
          console.warn('Aktivitätslog (Detailansicht) fehlgeschlagen:', e)
        }
      } else {
        throw new Error('Fehler beim Ändern des Status');
      }
    } catch (error) {
      console.error('Fehler beim Ändern des Status:', error);
      setSnackbar({
        open: true,
        message: 'Fehler beim Ändern des Status',
        severity: 'error'
      });
    }
  };

  const currentStatus = project ? statusOptions.find(option => option.value === project.status) : undefined;

  // State für Zeit-Bearbeiten/Löschen
  const [editTimeEntry, setEditTimeEntry] = React.useState<{ date: string, entry: any } | null>(null);
  const [deleteTimeEntry, setDeleteTimeEntry] = React.useState<{ date: string, entry: any } | null>(null);

  // Handler für Zeit löschen
  const handleDeleteTimeEntry = async (date: string, entryId: string) => {
    try {
      await ProjectsApi.update(id, { times: { action: 'delete', date, entryId } } as any)
      await fetchProjects();
      const updated = projects.find((p) => p.id === id);
      if (updated) setProject(updated);
      setSnackbar({ open: true, message: 'Zeiteintrag erfolgreich gelöscht.', severity: 'success' });
    } catch (err) {
      setSnackbar({ open: true, message: 'Fehler beim Löschen des Zeiteintrags.', severity: 'error' });
    }
  };

  // Handler für Zeit bearbeiten
  const handleEditTimeEntry = async (date: string, entry: any) => {
    setEditTimeEntry({ date, entry });
  };

  const handleSaveEditTimeEntry = async (dates: string[] | string, updatedEntry: any) => {
    try {
      const days = Array.isArray(dates) ? dates : [dates];
      for (const date of days) {
        const res = await ProjectsApi.update(id, { times: { action: 'edit', date, updatedEntry } } as any)
      }
      await fetchProjects();
      const updated = projects.find((p) => p.id === id);
      if (updated) setProject(updated);
      setSnackbar({ open: true, message: 'Zeiteintrag(e) erfolgreich bearbeitet.', severity: 'success' });
      setEditTimeEntry(null);
    } catch (err) {
      setSnackbar({ open: true, message: 'Fehler beim Bearbeiten der Zeiteinträge.', severity: 'error' });
    }
  };

  const exportRef = React.useRef<HTMLDivElement>(null);
  const handleDownloadPdf = async () => {
    setIsExporting(true);
    await new Promise(resolve => setTimeout(resolve, 100)); // kurz warten, damit das Ref aktualisiert ist
    if (exportRef.current) {
      const html2pdf = (await import('html2pdf.js')).default as any;
      const opt: any = {
        margin: 0.5,
        filename: `Projekt_${project?.name || 'Export'}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' as 'portrait' }
      };
      await html2pdf().set(opt).from(exportRef.current).save();
    }
    setIsExporting(false);
  };

  return (
    <div className="p-4 project-detail-page">
      {/* Locking-Status Anzeige */}
      {lockInfo.isLocked && (
        <div className="mb-4">
          {lockInfo.isOwnLock ? (
            <Alert className="border-green-200 bg-green-50 dark:bg-green-900/20 project-lock-alert">
              <Lock className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800 dark:text-green-200">
                Sie bearbeiten dieses Projekt. Sperre wird automatisch nach 30 Minuten Inaktivität freigegeben.
              </AlertDescription>
            </Alert>
          ) : (
            <Alert className="border-orange-200 bg-orange-50 dark:bg-orange-900/20 project-lock-alert">
              <Lock className="h-4 w-4 text-orange-600" />
              <AlertDescription className="text-orange-800 dark:text-orange-200">
                Projekt wird von {lockInfo.lockedBy?.name} bearbeitet. Sie können nur lesen.
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}

      <div className="flex justify-between items-center mb-6 project-detail-header">
        <Button 
          className="flex items-center gap-2 bg-slate-600 hover:bg-slate-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
          size="sm" 
          onClick={() => router.push('/projekte')}
        >
          <ArrowLeft className="h-4 w-4" />
          Zurück zu den Projekten
        </Button>
        <div className="flex items-center gap-2 project-lock-controls">
          {lockInfo.isOwnLock && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleReleaseLock}
              className="flex items-center gap-2"
            >
              <Unlock className="h-4 w-4" />
              Sperre freigeben
            </Button>
          )}
          <Button 
            className="bg-blue-700 hover:bg-blue-800 text-white rounded-xl shadow-lg px-6 h-12 project-export-button"
            onClick={() => {
              setExportSelectedDays(projectDays);
              setExportDayDialogOpen(true);
            }}
            disabled={lockInfo.isLocked && !lockInfo.isOwnLock}
          >
            Exportieren
          </Button>
        </div>
      </div>
      <h1 className="text-3xl font-bold text-[#114F6B] mb-6">
        Projektdetails
      </h1>
      
      {/* Lock-Status und Sperre freigeben Button */}
      {lockInfo.isOwnLock && (
        <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-green-600" />
            <span className="text-green-800 dark:text-green-200 font-medium">
              Sie bearbeiten dieses Projekt
            </span>
          </div>
        </div>
      )}
      
      {/* Debug entfernt */}
      
      {!id ? (
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#114F6B]"></div>
        </div>
      ) : error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : !project ? (
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#114F6B]"></div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Projektübersicht */}
          <Card className="bg-white dark:bg-slate-800 border border-[#C0D4DE] dark:border-slate-700">
            <CardContent className="p-6">
              <h2 className="text-2xl font-semibold mb-4">{project.name}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 text-base">
                <div><span className="font-semibold">Auftraggeber:</span> {project.auftraggeber}</div>
                <div><span className="font-semibold">Auftragsnummer:</span> {project.auftragsnummer}</div>
                <div><span className="font-semibold">Ansprechpartner:</span> {project.telefonnummer}</div>
                <div><span className="font-semibold">Baustelle:</span> {project.baustelle}</div>
                <div><span className="font-semibold">SAP Nummer:</span> {project.sapNummer}</div>
                <div><span className="font-semibold">Datum Beginn:</span> {project.datumBeginn}</div>
                <div><span className="font-semibold">Datum Ende:</span> {project.datumEnde}</div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">Status:</span>
                  {project ? (
                    <Select value={project.status} onValueChange={handleStatusChange} disabled={statusUpdating}>
                      <SelectTrigger className="w-40 rounded-xl border-slate-200">
                        <SelectValue>
                          <span className={`inline-block px-2 py-1 rounded-lg text-xs font-medium ${currentStatus?.color}`}>{currentStatus?.label}</span>
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {statusOptions.map(option => (
                          <SelectItem key={option.value} value={option.value}>
                            <span className={`inline-block px-2 py-1 rounded-lg text-xs font-medium ${option.color}`}>{option.label}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : null}
                </div>
              </div>
              {/* Technik-Informationen */}
              <div className="mt-6 pt-4 border-t border-slate-200">
                <h4 className="font-semibold text-slate-700 mb-2">Technik-Übersicht:</h4>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Technik Einsatz:</span>
                    <span className={`ml-2 ${technikStats.atwsImEinsatz ? 'text-green-600' : 'text-gray-500'}`}>
                      {technikStats.atwsImEinsatz ? 'Ja' : 'Nein'}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium">Anzahl ATWs:</span>
                    <span className="ml-2 text-blue-600">{technikStats.anzahlAtws}</span>
                  </div>
                  <div>
                    <span className="font-medium">Gesamt Meterlänge:</span>
                    <span className="ml-2 text-purple-600">{technikStats.gesamtMeterlaenge} m</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Technik */}
          <Card className="bg-white dark:bg-slate-800 border border-[#C0D4DE] dark:border-slate-700">
            <CardContent className="p-6">
              <div className="flex justify-between items-center mb-4 project-technik-add">
                <h3 className="text-xl font-semibold">Technik</h3>
                <Button 
                  className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
                  size="sm" 
                  onClick={() => setTechnikDialogOpen(true)}
                >
                  <Plus className="h-4 w-4" />
                  Technik hinzufügen
                </Button>
              </div>
              <TechnikList
                project={project!}
                selectedDate={selectedTechnikTag}
                onEdit={handleEditTechnik}
                onRemove={handleRemoveTechnik}
                onAdd={() => setTechnikDialogOpen(true)}
                onDateChange={setSelectedTechnikTag}
              />
            </CardContent>
          </Card>

          {/* Zeiteinträge */}
          <Card className="bg-white dark:bg-slate-800 border border-[#C0D4DE] dark:border-slate-700">
            <CardContent className="p-6">
              <div className="flex justify-between items-center mb-4 project-times-add">
                <h3 className="text-xl font-semibold">Zeiteinträge</h3>
                <Button 
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
                  size="sm" 
                  onClick={() => setZeitDialogOpen(true)}
                >
                  <Plus className="h-4 w-4" />
                  Zeiteintrag hinzufügen
                </Button>
              </div>
              <div className="flex flex-wrap gap-1 mb-4">
                {getProjectDays().map(day => (
                  <Button
                    key={day}
                    variant={selectedZeitTag === day ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedZeitTag(day)}
                    className="min-w-[110px]"
                  >
                    {format(parseISO(day), 'dd.MM.yyyy', { locale: de })}
                  </Button>
                ))}
              </div>
              <div className="text-gray-500">
                {project?.mitarbeiterZeiten?.[selectedZeitTag]?.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="dark:text-white">Mitarbeiter</TableHead>
                        <TableHead className="dark:text-white">Funktion</TableHead>
                        <TableHead className="dark:text-white">Start</TableHead>
                        <TableHead className="dark:text-white">Ende</TableHead>
                        <TableHead className="dark:text-white">Stunden</TableHead>
                        <TableHead className="dark:text-white">Pausen</TableHead>
                        <TableHead className="dark:text-white">Fahrtstunden</TableHead>
                        <TableHead className="dark:text-white">Nachtzuschlag (h)</TableHead>
                        <TableHead className="dark:text-white">Feiertag</TableHead>
                        <TableHead className="dark:text-white">Sonntagsstunden</TableHead>
                        <TableHead className="dark:text-white">Extra</TableHead>
                        <TableHead className="dark:text-white">Bemerkung</TableHead>
                        <TableHead className="dark:text-white">Aktionen</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(() => {
                         // Hole alle Einträge für den Tag, filtere Fortsetzungseinträge raus
                         const entries = (project.mitarbeiterZeiten[selectedZeitTag] || []).filter((entry: any) => !(typeof entry.bemerkung === 'string' && entry.bemerkung.includes('Fortsetzung vom Vortag')));
                         return entries.map((entry: any, idx: number) => {
                           // KEINE Zusammenführung/Summierung mehr nötig!
                           // Zeige einfach nur den Eintrag an, wie er gespeichert ist.
                           console.log('Angezeigter Eintrag:', entry);
                           return (
                             <TableRow key={idx} className="dark:text-white">
                              <TableCell className="dark:text-white">{entry.name}</TableCell>
                              <TableCell className="dark:text-white">{entry.funktion}</TableCell>
                              <TableCell className="dark:text-white">{entry.start === '00:00' ? '00:00' : entry.start}</TableCell>
                              <TableCell className="dark:text-white">{entry.ende === '24:00' ? '24:00' : entry.ende}</TableCell>
                              <TableCell className="dark:text-white">{formatHours(entry.stunden)}</TableCell>
                              <TableCell className="dark:text-white">{entry.pause}</TableCell>
                              <TableCell className="dark:text-white">{entry.fahrtstunden || '-'}</TableCell>
                              <TableCell className="dark:text-white">{entry.nachtzulage !== undefined && entry.nachtzulage !== null && entry.nachtzulage !== '' ? parseFloat(entry.nachtzulage).toFixed(2) + 'h' : '-'}</TableCell>
                              <TableCell className="dark:text-white">{entry.feiertag > 0 ? `${entry.feiertag}h` : '-'}</TableCell>
                              <TableCell className="dark:text-white">{entry.sonntagsstunden !== undefined && entry.sonntagsstunden !== null && entry.sonntagsstunden !== 0 ? parseFloat(entry.sonntagsstunden).toFixed(2) + 'h' : '-'}</TableCell>
                              <TableCell className="dark:text-white">{entry.extra ?? '-'}</TableCell>
                              <TableCell className="dark:text-white">{entry.bemerkung}</TableCell>
                              <TableCell className="dark:text-white">
                                <Button size="icon" variant="ghost" onClick={() => handleEditTimeEntry(selectedZeitTag, entry)}>
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button size="icon" variant="ghost" onClick={() => setDeleteTimeEntry({ date: selectedZeitTag, entry: entry })}>
                                  <Trash2 className="h-4 w-4 text-red-600" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        });
                      })()}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-gray-500">Keine Zeiteinträge für diesen Tag.</div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Fahrzeuge */}
          <Card className="bg-white dark:bg-slate-800 border border-[#C0D4DE] dark:border-slate-700">
            <CardContent className="p-6">
              <div className="flex justify-between items-center mb-4 project-vehicles-add">
                <h3 className="text-xl font-semibold">Fahrzeuge</h3>
                <Button 
                  className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
                  size="sm" 
                  onClick={() => setFahrzeugDialogOpen(true)}
                >
                  <Plus className="h-4 w-4" />
                  Fahrzeug zuweisen
                </Button>
              </div>
              <VehicleAssignmentList
                project={project!}
                vehicles={vehicles}
                selectedDate={selectedFahrzeugTag}
                onEdit={handleAddVehicle}
                onDateChange={setSelectedFahrzeugTag}
              />
            </CardContent>
          </Card>

          {/* Projektstatistiken */}
          <Card className="bg-white dark:bg-slate-800 border border-[#C0D4DE] dark:border-slate-700 project-statistics">
            <CardHeader>
              <CardTitle>Projektstatistiken</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Arbeitsstunden pro Tag (modernes Area-Chart mit Verlauf) */}
              <div>
                <h4 className="font-semibold mb-2">Arbeitsstunden pro Tag</h4>
                <div style={{ width: '100%', height: 300 }}>
                  <ResponsiveContainer>
                    <AreaChart data={getProjectDays().map(day => ({
                      date: format(parseISO(day), 'dd.MM.yyyy', { locale: de }),
                      stunden: (project.mitarbeiterZeiten?.[day] || []).reduce((sum, e) => sum + (e.stunden || 0), 0)
                    }))}>
                      <defs>
                        <linearGradient id="colorHours" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#2563eb" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#2563eb" stopOpacity={0.05} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="date" tick={{ fill: '#64748b' }} tickLine={false} axisLine={{ stroke: '#e5e7eb' }} />
                      <YAxis tick={{ fill: '#64748b' }} tickLine={false} axisLine={{ stroke: '#e5e7eb' }} />
                      <Tooltip contentStyle={{ borderRadius: 12 }} />
                      <Area type="monotone" dataKey="stunden" stroke="#2563eb" strokeWidth={2} fill="url(#colorHours)" name="Stunden" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
              {/* Verteilung nach Funktionen (Donut-Chart) */}
              <div>
                <h4 className="font-semibold mb-2">Verteilung nach Funktionen</h4>
                <div style={{ width: '100%', height: 300 }}>
                  <ResponsiveContainer>
                    <PieChart>
                      {(() => {
                        const funktionMap: Record<string, number> = {};
                        Object.values(project.mitarbeiterZeiten || {}).flat().forEach((e: any) => {
                          funktionMap[e.funktion] = (funktionMap[e.funktion] || 0) + 1;
                        });
                        const data = Object.entries(funktionMap).map(([name, value]) => ({ name, value }));
                        const palette = ['#114F6B', '#2563eb', '#22c55e', '#a21caf', '#f59e0b', '#06b6d4', '#8b5cf6', '#ef4444'];
                        return (
                          <Pie data={data} dataKey="value" nameKey="name" innerRadius={70} outerRadius={110} paddingAngle={2} cornerRadius={6}>
                            {data.map((_, idx) => (
                              <Cell key={`cell-${idx}`} fill={palette[idx % palette.length]} />
                            ))}
                          </Pie>
                        );
                      })()}
                      <Tooltip contentStyle={{ borderRadius: 12 }} formatter={(val: any) => [`${val}`, 'Anzahl']} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
              {/* Mitarbeiterauslastung (modernes Säulendiagramm) */}
              <div>
                <h4 className="font-semibold mb-2">Mitarbeiterauslastung</h4>
                <div style={{ width: '100%', height: 300 }}>
                  <ResponsiveContainer>
                    <BarChart data={(() => {
                      const mitarbeiterMap: Record<string, { stunden: number, tage: number }> = {};
                      Object.entries(project.mitarbeiterZeiten || {}).forEach(([_day, entries]: any) => {
                        entries.forEach((e: any) => {
                          if (!mitarbeiterMap[e.name]) mitarbeiterMap[e.name] = { stunden: 0, tage: 0 };
                          mitarbeiterMap[e.name].stunden += e.stunden || 0;
                          mitarbeiterMap[e.name].tage += 1;
                        });
                      });
                      return Object.entries(mitarbeiterMap)
                        .map(([name, data]) => ({ name, stunden: data.stunden, tage: data.tage }))
                        .sort((a, b) => b.stunden - a.stunden);
                    })()}>
                      <defs>
                        <linearGradient id="barBlue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#2563eb" stopOpacity={0.9} />
                          <stop offset="100%" stopColor="#2563eb" stopOpacity={0.55} />
                        </linearGradient>
                        <linearGradient id="barGreen" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#22c55e" stopOpacity={0.9} />
                          <stop offset="100%" stopColor="#22c55e" stopOpacity={0.55} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="name" tick={{ fill: '#64748b' }} tickLine={false} axisLine={{ stroke: '#e5e7eb' }} interval={0} angle={-15} textAnchor="end" height={60} />
                      <YAxis yAxisId="left" orientation="left" stroke="#2563eb" tick={{ fill: '#64748b' }} tickLine={false} axisLine={{ stroke: '#e5e7eb' }} />
                      <YAxis yAxisId="right" orientation="right" stroke="#22c55e" tick={{ fill: '#64748b' }} tickLine={false} axisLine={{ stroke: '#e5e7eb' }} />
                      <Tooltip
                        contentStyle={{ borderRadius: 12 }}
                        formatter={(value: any, _name: any, props: any) => {
                          const key = props?.dataKey as string | undefined;
                          if (key === 'stunden') return [typeof value === 'number' ? value.toFixed(2) : value, 'Stunden'];
                          if (key === 'tage') return [value, 'Einsatztage'];
                          return [value, _name];
                        }}
                      />
                      <Legend />
                      <Bar yAxisId="left" dataKey="stunden" fill="url(#barBlue)" name="Stunden" radius={[8,8,0,0]}>
                        <LabelList dataKey="stunden" position="top" formatter={(v: any) => (typeof v === 'number' ? v.toFixed(1) : v)} fill="#334155" />
                      </Bar>
                      <Bar yAxisId="right" dataKey="tage" fill="url(#barGreen)" name="Einsatztage" radius={[8,8,0,0]}>
                        <LabelList dataKey="tage" position="top" fill="#334155" />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              {/* ATW im Einsatz (modernes Säulendiagramm) */}
              <div>
                <h4 className="font-semibold mb-2">ATW im Einsatz</h4>
                <div style={{ width: '100%', height: 300 }}>
                  <ResponsiveContainer>
                    <BarChart data={(() => {
                      // Technik-Einträge aggregieren
                      const technikMap: Record<string, { anzahl: number, meterlaenge: number }> = {};
                      if (project.technik && typeof project.technik === 'object') {
                        Object.values(project.technik).forEach((arr: any) => {
                          if (Array.isArray(arr)) {
                            arr.forEach((t: any) => {
                              if (!technikMap[t.name]) technikMap[t.name] = { anzahl: 0, meterlaenge: 0 };
                              technikMap[t.name].anzahl += t.anzahl || 0;
                              technikMap[t.name].meterlaenge += t.meterlaenge || 0;
                            });
                          }
                        });
                      }
                      return Object.entries(technikMap)
                        .map(([name, data]) => ({ name, ...data }))
                        .sort((a, b) => b.anzahl - a.anzahl);
                    })()}>
                      <defs>
                        <linearGradient id="barBlueAtw" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#2563eb" stopOpacity={0.9} />
                          <stop offset="100%" stopColor="#2563eb" stopOpacity={0.55} />
                        </linearGradient>
                        <linearGradient id="barPurpleAtw" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#a21caf" stopOpacity={0.9} />
                          <stop offset="100%" stopColor="#a21caf" stopOpacity={0.55} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="name" tick={{ fill: '#64748b' }} tickLine={false} axisLine={{ stroke: '#e5e7eb' }} interval={0} angle={-15} textAnchor="end" height={60} />
                      <YAxis yAxisId="left" orientation="left" stroke="#2563eb" tick={{ fill: '#64748b' }} tickLine={false} axisLine={{ stroke: '#e5e7eb' }} />
                      <YAxis yAxisId="right" orientation="right" stroke="#a21caf" tick={{ fill: '#64748b' }} tickLine={false} axisLine={{ stroke: '#e5e7eb' }} />
                      <Tooltip
                        contentStyle={{ borderRadius: 12 }}
                        formatter={(value: any, _name: any, props: any) => {
                          const key = props?.dataKey as string | undefined;
                          if (key === 'anzahl') return [value, 'Anzahl'];
                          if (key === 'meterlaenge') return [`${value} m`, 'Meterlänge'];
                          return [value, _name];
                        }}
                      />
                      <Legend />
                      <Bar yAxisId="left" dataKey="anzahl" fill="url(#barBlueAtw)" name="Anzahl" radius={[8,8,0,0]}>
                        <LabelList dataKey="anzahl" position="top" fill="#334155" />
                      </Bar>
                      <Bar yAxisId="right" dataKey="meterlaenge" fill="url(#barPurpleAtw)" name="Meterlänge" radius={[8,8,0,0]}>
                        <LabelList dataKey="meterlaenge" position="top" formatter={(v: any) => `${v} m`} fill="#334155" />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex gap-8 items-center text-sm font-medium mt-2">
                  <span>Anzahl ATWs: <span className="text-blue-700">{technikStats.anzahlAtws}</span></span>
                  <span>Gesamt Meterlänge: <span className="text-purple-700">{technikStats.gesamtMeterlaenge} m</span></span>
                </div>
              </div>
              {/* KFZ im Einsatz (modernes Säulendiagramm) */}
              <div>
                <h4 className="font-semibold mb-2">KFZ im Einsatz</h4>
                <div style={{ width: '100%', height: 300 }}>
                  <ResponsiveContainer>
                    <BarChart data={(() => {
                      // Fahrzeuge aggregieren: key = type + licensePlate
                      const kfzMap: Record<string, { type: string, licensePlate: string, count: number, mitarbeiter: Set<string> }> = {};
                      Object.values(project.fahrzeuge || {}).forEach((fahrzeugeArr: any) => {
                        (fahrzeugeArr || []).forEach((v: any) => {
                          const key = v.type + ' ' + v.licensePlate;
                          if (!kfzMap[key]) kfzMap[key] = { type: v.type, licensePlate: v.licensePlate, count: 0, mitarbeiter: new Set() };
                          kfzMap[key].count += 1;
                          if (v.mitarbeiterName) kfzMap[key].mitarbeiter.add(v.mitarbeiterName);
                        });
                      });
                      return Object.values(kfzMap)
                        .map(kfz => ({
                          name: kfz.type + ' ' + kfz.licensePlate,
                          count: kfz.count,
                          mitarbeiter: Array.from(kfz.mitarbeiter).join(', ')
                        }))
                        .sort((a, b) => b.count - a.count);
                    })()}>
                      <defs>
                        <linearGradient id="barTealKfz" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.9} />
                          <stop offset="100%" stopColor="#06b6d4" stopOpacity={0.55} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="name" tick={{ fill: '#64748b' }} tickLine={false} axisLine={{ stroke: '#e5e7eb' }} interval={0} angle={-15} textAnchor="end" height={60} />
                      <YAxis allowDecimals={false} tick={{ fill: '#64748b' }} tickLine={false} axisLine={{ stroke: '#e5e7eb' }} />
                      <Tooltip
                        contentStyle={{ borderRadius: 12 }}
                        labelFormatter={(label: any, payload: any) => {
                          const employees = payload && payload[0] && payload[0].payload ? payload[0].payload.mitarbeiter : '';
                          return employees ? `${label} — ${employees}` : label;
                        }}
                        formatter={(value: any) => [value, 'Einsatztage']}
                      />
                      <Legend />
                      <Bar dataKey="count" fill="url(#barTealKfz)" name="Einsatztage" radius={[8,8,0,0]}>
                        <LabelList dataKey="count" position="top" fill="#334155" />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <Table className="mt-2">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tag</TableHead>
                      <TableHead>Fahrzeug</TableHead>
                      <TableHead>Kennzeichen</TableHead>
                      <TableHead>Mitarbeiter</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(project.fahrzeuge || {}).flatMap(([day, fahrzeuge]: any) =>
                      (fahrzeuge || []).map((v: any, idx: number) => (
                        <TableRow key={day + v.id + idx}>
                          <TableCell>{day}</TableCell>
                          <TableCell>{v.type}</TableCell>
                          <TableCell>{v.licensePlate}</TableCell>
                          <TableCell>{v.mitarbeiterName || '-'}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
              {/* Projektzusammenfassung (am Ende) */}
              <div>
                <h4 className="font-semibold mb-2 mt-8">Projektzusammenfassung</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="font-medium">Gesamtarbeitsstunden:</span> {Object.values(project.mitarbeiterZeiten || {}).flat().reduce((sum, e: any) => sum + (e.stunden || 0), 0).toFixed(2)}</div>
                  <div><span className="font-medium">Gesamtfahrstunden:</span> {Object.values(project.mitarbeiterZeiten || {}).flat().reduce((sum, e: any) => sum + (e.fahrtstunden || 0), 0).toFixed(2)}</div>
                  <div><span className="font-medium">Eingesetzte Mitarbeiter:</span> {(() => {
                    const mitarbeiterSet = Object.values(project.mitarbeiterZeiten || {}).flat().reduce((acc: Set<string>, e: any) => acc.add(e.name), new Set());
                    return mitarbeiterSet.size;
                  })()}</div>
                  <div><span className="font-medium">Eingesetzte Funktionen:</span> {(() => {
                    const funktionenSet = Object.values(project.mitarbeiterZeiten || {}).flat().reduce((acc: Set<string>, e: any) => acc.add(e.funktion), new Set());
                    return funktionenSet.size + ' (' + Array.from(funktionenSet).join(', ') + ')';
                  })()}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Dialoge */}
      <Dialog open={technikDialogOpen} onOpenChange={setTechnikDialogOpen}>
        <DialogContent className="sm:max-w-lg rounded-2xl border-0 shadow-2xl bg-white dark:bg-slate-800">
          <DialogTitle className="flex items-center gap-3 text-xl font-semibold text-slate-900 pb-4 border-b border-slate-100">
            <div className="p-2 bg-green-100 rounded-xl">
              <Plus className="h-6 w-6 text-green-600" />
            </div>
            Technik hinzufügen
          </DialogTitle>
          <div className="py-4">
            <TechnikAssignmentForm
              project={project!}
              onAssign={handleAssignTechnikMultiple}
              onClose={() => setTechnikDialogOpen(false)}
            />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={zeitDialogOpen} onOpenChange={setZeitDialogOpen}>
        <DialogContent className="sm:max-w-2xl rounded-2xl border-0 shadow-2xl bg-white dark:bg-slate-800">
          <DialogTitle className="flex items-center gap-3 text-xl font-semibold text-slate-900 pb-4 border-b border-slate-100">
            <div className="p-2 bg-blue-100 rounded-xl">
              <Plus className="h-6 w-6 text-blue-600" />
            </div>
            Zeiteintrag hinzufügen
          </DialogTitle>
          <div className="py-4">
            <TimeEntryForm
              project={project!}
              selectedDate={selectedZeitTag}
              onAdd={handleAddTimeEntry}
              onClose={() => setZeitDialogOpen(false)}
              employees={employees}
              hasExistingTimeEntries={hasExistingTimeEntries()}
            />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={fahrzeugDialogOpen} onOpenChange={setFahrzeugDialogOpen}>
        <DialogContent className="sm:max-w-lg rounded-2xl border-0 shadow-2xl bg-white dark:bg-slate-800">
          <DialogTitle className="flex items-center gap-3 text-xl font-semibold text-slate-900 pb-4 border-b border-slate-100">
            <div className="p-2 bg-purple-100 rounded-xl">
              <Plus className="h-6 w-6 text-purple-600" />
            </div>
            Fahrzeug zuweisen
          </DialogTitle>
          <div className="py-4">
            <VehicleAssignmentForm
              project={project!}
              vehicles={vehicles}
              onVehicleAssigned={handleAddVehicle}
              onClose={() => setFahrzeugDialogOpen(false)}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog für Zeit bearbeiten */}
      {editTimeEntry && (
        <Dialog open={!!editTimeEntry} onOpenChange={() => setEditTimeEntry(null)}>
          <DialogContent className="sm:max-w-2xl rounded-2xl border-0 shadow-2xl bg-white dark:bg-slate-800">
            <DialogTitle className="flex items-center gap-3 text-xl font-semibold text-slate-900 pb-4 border-b border-slate-100">
              <div className="p-2 bg-blue-100 rounded-xl">
                <Edit className="h-6 w-6 text-blue-600" />
              </div>
              Zeiteintrag bearbeiten
            </DialogTitle>
            <div className="py-4">
              <EditTimeEntryForm
                project={project!}
                selectedDate={editTimeEntry.date}
                entry={editTimeEntry.entry}
                onEdit={(date, updatedEntry) => handleSaveEditTimeEntry(date, updatedEntry)}
                onClose={() => setEditTimeEntry(null)}
                employees={employees}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
      {/* Dialog für Zeit löschen */}
      {deleteTimeEntry && (
        <Dialog open={!!deleteTimeEntry} onOpenChange={() => setDeleteTimeEntry(null)}>
          <DialogContent className="sm:max-w-md rounded-xl bg-white dark:bg-slate-800">
            <DialogTitle className="flex items-center gap-2 text-slate-900">
              <Trash2 className="h-5 w-5 text-red-600" />
              Zeiteintrag löschen
            </DialogTitle>
            <div className="space-y-4">
              <p className="text-slate-600">
                Möchten Sie den Zeiteintrag von <strong>{deleteTimeEntry.entry.name}</strong> am <strong>{deleteTimeEntry.date}</strong> wirklich löschen?
              </p>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setDeleteTimeEntry(null)} className="rounded-lg border-slate-200 hover:bg-slate-50">Abbrechen</Button>
                <Button variant="destructive" onClick={() => { handleDeleteTimeEntry(deleteTimeEntry.date, deleteTimeEntry.entry.id); setDeleteTimeEntry(null); }} className="bg-red-600 hover:bg-red-700 text-white rounded-lg">Löschen</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Dialog für Tagesauswahl vor Export */}
      <Dialog open={exportDayDialogOpen} onOpenChange={setExportDayDialogOpen}>
        <DialogContent className="max-w-lg w-full bg-white dark:bg-slate-800 rounded-2xl border-0 shadow-2xl">
          <DialogTitle className="text-xl font-semibold">Tage für den Export auswählen</DialogTitle>
          <div className="mt-4">
            <ScrollArea className="h-[360px] pr-2">
              <div className="flex flex-wrap gap-2">
                {projectDays.map(day => {
                  return (
                    <Button
                      key={day}
                      variant={exportSelectedDays.includes(day) ? 'default' : 'outline'}
                      size="sm"
                      className={`rounded-xl min-w-[110px] ${exportSelectedDays.includes(day) ? 'bg-blue-600 text-white' : ''}`}
                      onClick={() => {
                        setExportSelectedDays(prev =>
                          prev.includes(day)
                            ? prev.filter(d => d !== day)
                            : [...prev, day]
                        );
                      }}
                    >
                      {format(parseISO(day), 'dd.MM.yyyy', { locale: de })}
                    </Button>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
          <div className="flex items-center gap-3 mt-4">
            <Button
              variant={exportSelectedDays.length === projectDays.length ? 'default' : 'outline'}
              size="sm"
              onClick={() => setExportSelectedDays(projectDays)}
            >
              Alle Tage auswählen
            </Button>
            <Button
              variant={exportSelectedDays.length === 0 ? 'default' : 'outline'}
              size="sm"
              onClick={() => setExportSelectedDays([])}
            >
              Keine Tage
            </Button>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="outline" onClick={() => setExportDayDialogOpen(false)}>Abbrechen</Button>
            <Button
              className="bg-blue-700 hover:bg-blue-800 text-white rounded-xl px-6 h-12"
              disabled={exportSelectedDays.length === 0}
              onClick={() => {
                setExportDayDialogOpen(false);
                setExportDialogOpen(true);
              }}
            >
              Weiter zum Export
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog für Export */}
      <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <DialogContent className="max-w-4xl w-full bg-white dark:bg-slate-800 rounded-2xl border-0 shadow-2xl print:shadow-none print:border-none print:rounded-none print:max-w-full print:w-full my-12">
          <DialogTitle>
            <VisuallyHidden>Projekt-Export</VisuallyHidden>
          </DialogTitle>
          <div
            ref={exportRef}
            className={`p-8 pt-12 pb-24 print:p-0 ${!isExporting ? 'max-h-screen overflow-y-auto' : 'mt-12 mb-24'}`}
          >
            <div className="flex flex-col items-center mb-8">
              <img src="/mwd-logo.png" alt="Mülheimer Wachdienst Logo" width="120" height="120" style={{ marginBottom: 16 }} />
              <h2 className="text-2xl font-bold text-[#114F6B] mb-2">Projektübersicht</h2>
            </div>
            {/* Projektübersicht als Info-Grid */}
              <div className="grid grid-cols-2 gap-4 text-base mb-8">
              <div><span className="font-semibold">Projektname:</span> {project?.name}</div>
              <div><span className="font-semibold">Auftraggeber:</span> {project?.auftraggeber}</div>
              <div><span className="font-semibold">Status:</span> {project?.status}</div>
              <div><span className="font-semibold">Zeitraum:</span> {project?.datumBeginn} - {project?.datumEnde}</div>
              <div><span className="font-semibold">Eingesetzte Mitarbeiter:</span> {(() => {
                const mitarbeiterSet = Object.entries(project?.mitarbeiterZeiten || {}).filter(([day]) => exportSelectedDays.includes(day)).flatMap(([, entries]: any) => entries).reduce((acc: Set<string>, e: any) => acc.add(e.name), new Set());
                return mitarbeiterSet.size;
              })()}</div>
              <div><span className="font-semibold">Eingesetzte Funktionen:</span> {(() => {
                const funktionenSet = Object.entries(project?.mitarbeiterZeiten || {}).filter(([day]) => exportSelectedDays.includes(day)).flatMap(([, entries]: any) => entries).reduce((acc: Set<string>, e: any) => acc.add(e.funktion), new Set());
                return funktionenSet.size + ' (' + Array.from(funktionenSet).join(', ') + ')';
              })()}</div>
            </div>
            {/* Exportierte Tage und Timestamp */}
            <div className="grid grid-cols-2 gap-4 text-base mb-4">
              <div><span className="font-semibold">Exportierte Tage:</span> {exportSelectedDays.map(day => format(parseISO(day), 'dd.MM.yyyy', { locale: de })).join(', ')}</div>
              <div><span className="font-semibold">Exportzeitpunkt:</span> {format(new Date(), 'dd.MM.yyyy HH:mm:ss', { locale: de })}</div>
            </div>
            {/* Technik Tabelle */}
            <h3 className="text-xl font-semibold mt-8 mb-2">Technik</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Anzahl</TableHead>
                  <TableHead>Meterlänge</TableHead>
                  <TableHead>Bemerkung</TableHead>
                  <TableHead>Tag</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(project?.technik || {}).filter(([day]) => exportSelectedDays.includes(day)).flatMap(([day, technikArr]: any) =>
                  (technikArr || []).map((t: any, idx: number) => (
                    <TableRow key={day + t.id + idx}>
                      <TableCell>{t.name}</TableCell>
                      <TableCell>{t.anzahl}</TableCell>
                      <TableCell>{t.meterlaenge} m</TableCell>
                      <TableCell>{t.bemerkung || '-'}</TableCell>
                      <TableCell>{day}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            {/* Zeiten Tabelle */}
            <h3 className="text-xl font-semibold mt-8 mb-2">Zeiten</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tag</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Funktion</TableHead>
                  <TableHead>Beginn</TableHead>
                  <TableHead>Ende</TableHead>
                  <TableHead>Stunden</TableHead>
                  <TableHead>Pause</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(project?.mitarbeiterZeiten || {}).filter(([day]) => exportSelectedDays.includes(day)).flatMap(([day, entries]: any) =>
                  (entries || []).map((e: any, idx: number) => (
                    <TableRow key={day + e.id + idx}>
                      <TableCell>{day}</TableCell>
                      <TableCell>{e.name}</TableCell>
                      <TableCell>{e.funktion}</TableCell>
                      <TableCell>{e.start}</TableCell>
                      <TableCell>{e.ende}</TableCell>
                      <TableCell>{formatHours(e.stunden)}</TableCell>
                      <TableCell>{e.pause || '-'}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            {/* Fahrzeuge Tabelle - aus PDF-Export entfernt */}
            {/* <h3 className="text-xl font-semibold mt-8 mb-2">Fahrzeuge</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tag</TableHead>
                  <TableHead>Fahrzeug</TableHead>
                  <TableHead>Kennzeichen</TableHead>
                  <TableHead>Mitarbeiter</TableHead>
                  <TableHead>Kilometer</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(project?.fahrzeuge || {}).filter(([day]) => exportSelectedDays.includes(day)).flatMap(([day, fahrzeugeArr]: any) =>
                  (fahrzeugeArr || []).map((v: any, idx: number) => (
                    <TableRow key={day + v.id + idx}>
                      <TableCell>{day}</TableCell>
                      <TableCell>{v.type}</TableCell>
                      <TableCell>{v.licensePlate}</TableCell>
                      <TableCell>{v.mitarbeiterName || '-'}</TableCell>
                      <TableCell>{v.kilometers || '-'}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table> */}
            {/* Buttons nur im Dialog, nicht im PDF-Export */}
            {!isExporting && (
              <div className="mt-8 flex justify-end gap-4 print:hidden">
                <Button onClick={handleDownloadPdf} className="bg-blue-700 hover:bg-blue-800 text-white rounded-xl px-6 h-12">Downloaden</Button>
                <Button onClick={() => setExportDialogOpen(false)} className="bg-slate-500 hover:bg-slate-600 text-white rounded-xl px-6 h-12">Schließen</Button>
              </div>
            )}
            {/* Abstand unten nur im PDF-Export */}
            {isExporting && <div className="h-16" />}
          </div>
        </DialogContent>
      </Dialog>

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

      {/* Resource Lock Dialog auf Detailseite nicht blockierend anzeigen (nur optional, falls später benötigt)
          Aktuell bewusst entfernt, um die gesamte Seite nicht zu blockieren. */}

      {/* Debug-Overlay entfernt */}
    </div>
  );
} 