"use client";
import React, { useState } from 'react';
import Link from 'next/link';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Alert, AlertDescription } from './ui/alert';
import { Edit, Trash2, Building2, CheckCircle } from 'lucide-react';
import type { Project } from '../types';
import { useResourceLock } from '../hooks/useResourceLock';
import { useSession } from 'next-auth/react';
import { ResourceLockDialog } from './ui/ResourceLockDialog';
import { ProjectsApi } from '@/lib/api/projects'

interface ProjectActionsProps {
  project: Project;
  onEdit?: () => void;
}

export default function ProjectActions({ project, onEdit }: ProjectActionsProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [lockDialogOpen, setLockDialogOpen] = useState(false);
  const [lockChecked, setLockChecked] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);

  // Echte Benutzer-ID aus der Session beziehen
  const { data: session } = useSession();
  const userId = (session as any)?.user?.id || '';
  const {
    lockInfo,
    acquireLock,
    checkLock,
  } = useResourceLock({
    resourceType: 'project',
    resourceId: project.id,
    autoAcquire: false,
    autoRelease: false, // hier nicht automatisch freigeben, nur Detailseite
    lazyLoad: true, // kein Dauer-Polling in der Übersicht
    checkInterval: 30,
    userId,
  });

  const handleDeleteClick = () => {
    setIsDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    setIsDeleting(true);
    try {
      const response = await ProjectsApi.remove(project.id)
      if ((response as any).message || (response as any).success !== false) {
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
        // Seite neu laden um die Änderung zu reflektieren
        window.location.reload();
      } else {
        console.error('Fehler beim Löschen des Projekts');
      }
    } catch (error) {
      console.error('Fehler beim Löschen des Projekts:', error);
    } finally {
      setIsDeleting(false);
      setIsDialogOpen(false);
    }
  };

  // Handler für Projektdetail-Navigation mit Lock-Prüfung
  const handleDetailClick = async () => {
    setLockChecked(false);
    await checkLock(true);
    setLockChecked(true);
    if (lockInfo.isLocked && !lockInfo.isOwnLock) {
      // Speichere die ausstehende Navigation
      setPendingNavigation(`/projektdetail/${project.id}`);
      setLockDialogOpen(true);
    } else {
      // Navigation erlauben
      window.location.href = `/projektdetail/${project.id}`;
    }
  };
  
  // Handler für Edit-Button mit Lock-Prüfung
  const handleEditClick = async () => {
    if (onEdit) {
      setLockChecked(false);
      await checkLock(true);
      setLockChecked(true);
      if (lockInfo.isLocked && !lockInfo.isOwnLock) {
        // Keine ausstehende Navigation, nur Dialog anzeigen
        setPendingNavigation(null);
        setLockDialogOpen(true);
      } else {
        // Edit-Funktion ausführen
        onEdit();
      }
    }
  };

  return (
    <>
      <div className="flex items-center justify-end gap-2">
        {onEdit && (
          <Button
            variant="ghost"
            size="sm"
            className="rounded-lg hover:bg-yellow-50 dark:hover:bg-yellow-900/30 hover:text-yellow-600 dark:hover:text-yellow-400"
            onClick={handleEditClick}
          >
            <Edit className="h-4 w-4" />
          </Button>
        )}
        <Button 
          variant="ghost" 
          size="sm" 
          className="rounded-lg hover:bg-green-50 dark:hover:bg-green-900/30 hover:text-green-600 dark:hover:text-green-400"
          onClick={handleDetailClick}
        >
          <Building2 className="h-4 w-4" />
        </Button>
        <Button 
          variant="ghost" 
          size="sm" 
          className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"
          onClick={handleDeleteClick}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Lösch-Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-xl bg-white dark:bg-slate-800">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
              <Trash2 className="h-5 w-5 text-red-600 dark:text-red-400" />
              Projekt löschen
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-slate-600 dark:text-slate-400">
              Sind Sie sicher, dass Sie das Projekt <strong className="text-slate-900 dark:text-white">{project.name}</strong> löschen möchten?
              Diese Aktion kann nicht rückgängig gemacht werden.
            </p>
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                disabled={isDeleting}
                className="rounded-lg border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 dark:text-white"
              >
                Abbrechen
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="bg-red-600 hover:bg-red-700 text-white rounded-lg"
              >
                {isDeleting ? 'Löschen...' : 'Löschen'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Erfolgs-Meldung */}
      {showSuccess && (
        <Alert className="border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-800 rounded-xl">
          <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
          <AlertDescription className="text-green-800 dark:text-green-200">
            Projekt erfolgreich gelöscht
          </AlertDescription>
        </Alert>
      )}

      {/* Resource Lock Dialog für Projektdetail-Blockierung - nur bei Aktionen anzeigen */}
      <ResourceLockDialog
        isOpen={lockDialogOpen && lockInfo.isLocked && !lockInfo.isOwnLock}
        onClose={() => setLockDialogOpen(false)}
        onRetry={async () => {
          // Aktiven Status neu laden mit force=true
          const currentStatus = await checkLock(true);
          console.log('Lock retry check result:', currentStatus);
          
          // Wenn die Sperre nicht mehr existiert oder es die eigene ist
          if (!currentStatus.isLocked || currentStatus.isOwnLock) {
            setLockDialogOpen(false);
            // Wenn eine Navigation ausstehend ist
            if (pendingNavigation) {
              window.location.href = pendingNavigation;
            } else if (onEdit) {
              onEdit();
            }
          } else {
            // Sperre existiert noch - Benutzer informieren
            console.log('Lock still exists after retry');
          }
        }}
        lockInfo={lockInfo}
        resourceType="project"
        resourceName={project.name}
        blockPage={false} // Nicht die gesamte Seite blockieren
      />
    </>
  );
} 