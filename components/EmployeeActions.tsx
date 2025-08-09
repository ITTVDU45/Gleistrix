"use client";
import React, { useState } from 'react';
import Link from 'next/link';
import { EmployeesApi } from '@/lib/api/employees'
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Alert, AlertDescription } from './ui/alert';
import { Edit, Trash2, CheckCircle } from 'lucide-react';
import type { Employee } from '../types/main';

interface EmployeeActionsProps {
  employee: Employee;
}

export default function EmployeeActions({ employee }: EmployeeActionsProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleDeleteClick = () => {
    setIsDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    setIsDeleting(true);
    try {
      await EmployeesApi.remove(employee.id)
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
      // Seite neu laden um die Änderung zu reflektieren
      window.location.reload();
    } catch (error) {
      console.error('Fehler beim Löschen des Mitarbeiters:', error);
    } finally {
      setIsDeleting(false);
      setIsDialogOpen(false);
    }
  };

  return (
    <>
      <div className="flex items-center justify-end gap-2">
        <Button asChild variant="ghost" size="sm" className="rounded-lg hover:bg-green-50 dark:hover:bg-green-900/30 hover:text-green-600 dark:hover:text-green-400">
          <Link href={`/mitarbeiter/${employee.id}`}>
            <Edit className="h-4 w-4" />
          </Link>
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
              Mitarbeiter löschen
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-slate-600 dark:text-slate-400">
              Sind Sie sicher, dass Sie den Mitarbeiter <strong className="text-slate-900 dark:text-white">{employee.name}</strong> löschen möchten?
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
            Mitarbeiter erfolgreich gelöscht
          </AlertDescription>
        </Alert>
      )}
    </>
  );
} 