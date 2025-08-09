"use client";
import React, { useState, useCallback, useEffect } from 'react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Alert, AlertDescription } from './ui/alert';
import { Edit, Trash2, CheckCircle } from 'lucide-react';
import type { Vehicle } from '../types';
import EditVehicleDialog from './EditVehicleDialog';
import { useResourceLock } from '../hooks/useResourceLock';
import { ResourceLockDialog } from './ui/ResourceLockDialog';
import { useSession } from 'next-auth/react';
import { VehiclesApi } from '@/lib/api/vehicles';

interface VehicleActionsProps {
  vehicle: Vehicle;
}

export default function VehicleActions({ vehicle }: VehicleActionsProps) {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isLockDialogOpen, setIsLockDialogOpen] = useState(false);
  const { data: session } = useSession();

  const {
    lockInfo,
    checkLock,
    acquireLock,
    releaseLock,
  } = useResourceLock({
    resourceType: 'vehicle',
    resourceId: vehicle.id,
    autoAcquire: false,
    autoRelease: true,
    lazyLoad: true,
    checkInterval: 15,
    userId: session?.user?.id,
  });

  const handleDeleteClick = () => {
    setIsDeleteDialogOpen(true);
  };

  const handleEditClick = useCallback(async () => {
    try {
      const status = await checkLock(true);
      if (status.isLocked && !status.isOwnLock) {
        setIsLockDialogOpen(true);
        return;
      }
      await acquireLock();
      setIsEditDialogOpen(true);
    } catch (e) {
      console.error('Fehler beim Öffnen des Bearbeitungsdialogs:', e);
    }
  }, [checkLock, acquireLock]);

  const handleDeleteConfirm = async () => {
    setIsDeleting(true);
    try {
      const resp = await VehiclesApi.remove(vehicle.id)
      if ((resp as any).success !== false) {
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
        // Seite neu laden um die Änderung zu reflektieren
        window.location.reload();
      } else {
        console.error('Fehler beim Löschen des Fahrzeugs');
      }
    } catch (error) {
      console.error('Fehler beim Löschen des Fahrzeugs:', error);
    } finally {
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
    }
  };

  const handleVehicleUpdated = async () => {
    try {
      await releaseLock();
    } catch {}
    // Seite neu laden um die Änderung zu reflektieren
    window.location.reload();
  };

  const handleEditOpenChange = useCallback(async (open: boolean) => {
    if (!open) {
      try {
        await releaseLock();
      } catch (e) {
        console.warn('Konnte Sperre beim Schließen nicht freigeben:', e);
      }
    }
    setIsEditDialogOpen(open);
  }, [releaseLock]);

  return (
    <>
      <div className="flex items-center justify-end gap-2">
        <Button 
          variant="ghost" 
          size="sm" 
          className="rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/30 hover:text-purple-600 dark:hover:text-purple-400"
          onClick={handleEditClick}
        >
          <Edit className="h-4 w-4" />
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

      {/* Bearbeiten-Dialog */}
      <EditVehicleDialog
        vehicle={vehicle}
        open={isEditDialogOpen}
        onOpenChange={handleEditOpenChange}
        onVehicleUpdated={handleVehicleUpdated}
      />

      {/* Lösch-Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-xl bg-white dark:bg-slate-800">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
              <Trash2 className="h-5 w-5 text-red-600 dark:text-red-400" />
              Fahrzeug löschen
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-slate-600 dark:text-slate-400">
              Sind Sie sicher, dass Sie das Fahrzeug <strong className="text-slate-900 dark:text-white">{vehicle.type} - {vehicle.licensePlate}</strong> löschen möchten?
              Diese Aktion kann nicht rückgängig gemacht werden.
            </p>
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setIsDeleteDialogOpen(false)}
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
            Fahrzeug erfolgreich gelöscht
          </AlertDescription>
        </Alert>
      )}

      {/* Lock-Dialog für Fahrzeug-Bearbeitung */}
      <ResourceLockDialog
        isOpen={isLockDialogOpen && lockInfo.isLocked && !lockInfo.isOwnLock}
        onClose={() => setIsLockDialogOpen(false)}
        onRetry={async () => {
          const status = await checkLock(true);
          if (!status.isLocked || status.isOwnLock) {
            setIsLockDialogOpen(false);
            await acquireLock();
            setIsEditDialogOpen(true);
          }
        }}
        lockInfo={lockInfo}
        resourceType="vehicle"
        resourceName={`${vehicle.type} ${vehicle.licensePlate || ''}`.trim()}
      />
    </>
  );
} 