"use client";
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader } from './ui/card';
import { Table, TableBody, TableCell, TableHeader, TableHead, TableRow } from './ui/table';
import { Badge } from './ui/badge';
import { Calendar, MapPin, User, Clock, Building2 } from 'lucide-react';
import type { Project, ProjectStatus } from '../types';
import { ProjectsApi } from '@/lib/api/projects'
import { ActivityLogApi } from '@/lib/api/activityLog'
import ProjectActions from './ProjectActions';
import InlineStatusSelect from './InlineStatusSelect';

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

export default function ProjectTableClient({ projects }: { projects: Project[] }) {
  const router = useRouter();
  const [localProjects, setLocalProjects] = useState<Project[]>(projects);

  // Aktualisiere localProjects wenn sich projects ändert
  React.useEffect(() => {
    setLocalProjects(projects);
  }, [projects]);
  
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

      // Optional: Seite neu laden um alle Änderungen zu reflektieren
      // window.location.reload();
    } catch (error) {
      console.error('Fehler beim Aktualisieren des Status:', error);
      throw error;
    }
  };

  return (
    <Card className="border-0 shadow-lg bg-white dark:bg-slate-800 rounded-xl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Projektliste</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              {localProjects.length} Projekte
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {localProjects.length > 0 ? (
          <div className="rounded-xl border border-slate-200 dark:border-slate-600 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 dark:bg-slate-700">
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
                {localProjects.map((project: Project) => (
                  <TableRow key={project.id} className="hover:bg-slate-50 dark:hover:bg-slate-700">
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
      </CardContent>
    </Card>
  );
} 