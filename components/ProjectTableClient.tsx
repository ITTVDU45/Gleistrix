"use client";
import React, { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader } from './ui/card';
import { Table, TableBody, TableCell, TableHeader, TableHead, TableRow } from './ui/table';
import { Badge } from './ui/badge';
import { Calendar, MapPin, User, Clock, Building2, Trash2, Loader2 } from 'lucide-react';
import type { Project, ProjectStatus } from '../types';
import { ProjectsApi } from '@/lib/api/projects'
import { ActivityLogApi } from '@/lib/api/activityLog'
import ProjectActions from './ProjectActions';
import InlineStatusSelect from './InlineStatusSelect';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';

function getStatusColor(status: string) {
  switch (status) {
    case 'aktiv':
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
    case 'abgeschlossen':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
    case 'fertiggestellt':
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
  }
}

function getTotalHours(project: Project) {
  return Object.values(project.mitarbeiterZeiten || {}).reduce((sum: number, entries: any[]) => {
    return sum + entries.reduce((entrySum: number, entry: any) => entrySum + entry.stunden, 0);
  }, 0);
}

// Limit-Optionen für die Anzeige
const DISPLAY_LIMIT_OPTIONS = [
  { value: 10, label: '10 Projekte' },
  { value: 20, label: '20 Projekte' },
  { value: 30, label: '30 Projekte' },
  { value: 40, label: '40 Projekte' },
  { value: 50, label: '50 Projekte' },
  { value: 60, label: '60 Projekte' },
  { value: 100, label: '100 Projekte' },
  { value: 'all' as const, label: 'Alle Projekte' },
];

export default function ProjectTableClient({ projects }: { projects: Project[] }) {
  const router = useRouter();
  const [localProjects, setLocalProjects] = useState<Project[]>(projects);
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set());
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [displayLimit, setDisplayLimit] = useState<number | 'all'>(10);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const closeSnackbar = () => setSnackbar({ open: false, message: '', severity: 'success' });

  // Sortierte und limitierte Projekte (neueste zuerst)
  const displayedProjects = useMemo(() => {
    const sorted = [...localProjects].sort((a, b) => 
      new Date(b.datumBeginn).getTime() - new Date(a.datumBeginn).getTime()
    );
    if (displayLimit === 'all') return sorted;
    return sorted.slice(0, displayLimit);
  }, [localProjects, displayLimit]);

  // Selection-Logik (basierend auf displayedProjects)
  const allSelected = useMemo(() => 
    displayedProjects.length > 0 && displayedProjects.every(p => selectedProjects.has(p.id)),
    [displayedProjects, selectedProjects]
  );

  const someSelected = useMemo(() => 
    selectedProjects.size > 0 && !allSelected,
    [selectedProjects.size, allSelected]
  );

  const toggleSelectAll = useCallback(() => {
    if (allSelected) {
      setSelectedProjects(new Set());
    } else {
      setSelectedProjects(new Set(displayedProjects.map(p => p.id)));
    }
  }, [allSelected, displayedProjects]);

  const toggleSelectProject = useCallback((projectId: string) => {
    setSelectedProjects(prev => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  }, []);

  // Bulk-Delete-Funktion
  const handleBulkDelete = useCallback(async () => {
    if (selectedProjects.size === 0) return;

    setIsDeleting(true);
    try {
      const result = await ProjectsApi.bulkDelete(Array.from(selectedProjects));
      
      // Optimistic Update - entferne gelöschte Projekte
      setLocalProjects(prev => prev.filter(p => !selectedProjects.has(p.id)));
      setSelectedProjects(new Set());
      setShowDeleteModal(false);
      
      setSnackbar({ 
        open: true, 
        message: `${result.deletedCount} Projekte erfolgreich gelöscht`, 
        severity: 'success' 
      });

      // Seite nach kurzer Verzögerung neu laden
      setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
      console.error('Fehler beim Bulk-Delete:', error);
      setSnackbar({ 
        open: true, 
        message: 'Fehler beim Löschen der Projekte', 
        severity: 'error' 
      });
    } finally {
      setIsDeleting(false);
    }
  }, [selectedProjects]);

  // Aktualisiere localProjects wenn sich projects ändert
  React.useEffect(() => {
    setLocalProjects(projects);
  }, [projects]);

  // Snackbar automatisch schließen
  React.useEffect(() => {
    if (snackbar.open) {
      const timer = setTimeout(() => closeSnackbar(), 3000);
      return () => clearTimeout(timer);
    }
  }, [snackbar.open]);
  
  const handleEdit = (projectId: string) => {
    router.push(`/projekte?edit=${projectId}`);
  };

  const handleStatusChange = async (projectId: string, newStatus: ProjectStatus) => {
    try {
      await ProjectsApi.updateStatus(projectId, newStatus)

      // Optimistic Update
      setLocalProjects(prev => 
        prev.map(project => 
          project.id === projectId 
            ? { ...project, status: newStatus }
            : project
        )
      );

      // Aktivität protokollieren
      try {
        const changedProject = localProjects.find(p => p.id === projectId);
        await ActivityLogApi.create({
          actionType: 'project_status_changed',
          module: 'project',
          details: {
            description: `Projektstatus geändert: ${changedProject?.name ?? projectId} → ${newStatus}`,
            entityId: projectId,
            entityName: changedProject?.name
          }
        } as any)
      } catch (e) {
        // Fehler beim Loggen nicht blockierend
        console.warn('Aktivitätslog fehlgeschlagen:', e)
      }

      // Erfolg Snackbar anzeigen
      setSnackbar({ open: true, message: 'Status erfolgreich aktualisiert', severity: 'success' });

      // Optional: Seite neu laden um alle Änderungen zu reflektieren
      // window.location.reload();
    } catch (error) {
      console.error('Fehler beim Aktualisieren des Status:', error);
      // Fehler Snackbar anzeigen
      setSnackbar({ open: true, message: 'Fehler beim Aktualisieren des Status', severity: 'error' });
      throw error;
    }
  };

  return (
    <>
      {snackbar.open && (
        <div
          className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg ${
            snackbar.severity === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
          }`}
        >
          {snackbar.message}
          <button onClick={closeSnackbar} className="ml-2 text-white hover:text-gray-200">
            ×
          </button>
        </div>
      )}

      <Card className="border-0 shadow-lg bg-white dark:bg-slate-800 rounded-xl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Projektliste</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Zeige {displayedProjects.length} von {localProjects.length} Projekten
              {selectedProjects.size > 0 && (
                <span className="ml-2 text-blue-600 dark:text-blue-400">
                  ({selectedProjects.size} ausgewählt)
                </span>
              )}
            </p>
          </div>
          {selectedProjects.size > 0 && (
            <button
              onClick={() => setShowDeleteModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 
                         text-white font-medium rounded-lg transition-colors
                         disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isDeleting}
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              {selectedProjects.size} löschen
            </button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {displayedProjects.length > 0 ? (
          <div className="rounded-xl border border-slate-200 dark:border-slate-600 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 dark:bg-slate-700">
                  <TableHead className="w-12">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = someSelected;
                      }}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 
                                 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      title={allSelected ? 'Alle abwählen' : 'Alle auswählen'}
                    />
                  </TableHead>
                  <TableHead className="font-medium text-slate-700 dark:text-slate-300">Projekt</TableHead>
                  <TableHead className="font-medium text-slate-700 dark:text-slate-300">Auftraggeber</TableHead>
                  <TableHead className="font-medium text-slate-700 dark:text-slate-300">Baustelle</TableHead>
                  <TableHead className="font-medium text-slate-700 dark:text-slate-300">Status</TableHead>
                  <TableHead className="font-medium text-slate-700 dark:text-slate-300">Datum</TableHead>
                  <TableHead className="font-medium text-slate-700 dark:text-slate-300">Stunden</TableHead>
                  <TableHead className="font-medium text-slate-700 dark:text-slate-300 text-right">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayedProjects.map((project: Project) => (
                  <TableRow 
                    key={project.id} 
                    className={`hover:bg-slate-50 dark:hover:bg-slate-700 ${
                      selectedProjects.has(project.id) ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                    }`}
                  >
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selectedProjects.has(project.id)}
                        onChange={() => toggleSelectProject(project.id)}
                        className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 
                                   text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium text-slate-900 dark:text-white">{project.name}</p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">#{project.auftragsnummer}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                        <span className="text-slate-700 dark:text-slate-300">{project.auftraggeber}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                        <span className="text-slate-700 dark:text-slate-300">{project.baustelle}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <InlineStatusSelect 
                        project={project} 
                        onStatusChange={handleStatusChange}
                        showInlineFeedback={false}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                        <span className="text-slate-700 dark:text-slate-300">
                          {new Date(project.datumBeginn).toLocaleDateString('de-DE')}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                        <span className="text-slate-700 dark:text-slate-300">
                          {getTotalHours(project).toFixed(1)}h
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <ProjectActions project={project} onEdit={() => handleEdit(project.id)} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-12">
            <Building2 className="h-12 w-12 text-slate-400 mx-auto mb-4" />
            <p className="text-slate-600">Keine Projekte vorhanden</p>
            <p className="text-sm text-slate-500 mt-1">Erstellen Sie Ihr erstes Projekt</p>
          </div>
        )}

        {/* Limit-Auswahl Dropdown */}
        {localProjects.length > 0 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-200 dark:border-slate-600">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Zeige {displayedProjects.length} von {localProjects.length} Projekten
            </p>
            <div className="flex items-center gap-2">
              <label htmlFor="displayLimit" className="text-sm text-slate-600 dark:text-slate-400">
                Anzeigen:
              </label>
              <select
                id="displayLimit"
                value={displayLimit}
                onChange={(e) => {
                  const value = e.target.value;
                  setDisplayLimit(value === 'all' ? 'all' : parseInt(value, 10));
                  // Auswahl zurücksetzen bei Limit-Änderung
                  setSelectedProjects(new Set());
                }}
                className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 
                           bg-white dark:bg-slate-700 text-slate-900 dark:text-white
                           text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent
                           cursor-pointer"
              >
                {DISPLAY_LIMIT_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </CardContent>
    </Card>

    {/* Bulk-Delete Bestätigungs-Modal */}
    <ConfirmDeleteModal
      isOpen={showDeleteModal}
      onConfirm={handleBulkDelete}
      onCancel={() => setShowDeleteModal(false)}
      itemCount={selectedProjects.size}
      itemType="Projekte"
      confirmText="Löschen"
    />
    </>
  );
} 