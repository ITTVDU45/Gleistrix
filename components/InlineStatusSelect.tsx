"use client";
import * as React from 'react';
import { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { CheckCircle, AlertCircle } from 'lucide-react';
import type { Project, ProjectStatus } from '../types';

interface InlineStatusSelectProps {
  project: Project;
  onStatusChange: (projectId: string, newStatus: ProjectStatus) => Promise<void>;
}

export default function InlineStatusSelect({ project, onStatusChange }: InlineStatusSelectProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const statusOptions = [
    { value: 'aktiv' as ProjectStatus, label: 'Aktiv', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
    { value: 'abgeschlossen' as ProjectStatus, label: 'Abgeschlossen', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
    { value: 'fertiggestellt' as ProjectStatus, label: 'Fertiggestellt', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400' },
    { value: 'geleistet' as ProjectStatus, label: 'Geleistet', color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400' },
    { value: 'kein Status' as ProjectStatus, label: 'Kein Status', color: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400' }
  ];

  const currentStatus = statusOptions.find(option => option.value === project.status);

  const handleStatusChange = async (newStatus: string) => {
    if (newStatus === project.status) return;
    
    setIsUpdating(true);
    setShowSuccess(false);
    setShowError(false);
    
    try {
      await onStatusChange(project.id, newStatus as ProjectStatus);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (error) {
      setErrorMessage('Fehler beim Aktualisieren des Status. Bitte versuchen Sie es erneut.');
      setShowError(true);
      setTimeout(() => setShowError(false), 5000);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="relative">
      <Select 
        value={project.status} 
        onValueChange={handleStatusChange} 
        disabled={isUpdating}
      >
        <SelectTrigger className="h-8 w-32 border-0 bg-transparent p-0 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-colors">
          <SelectValue>
            <Badge className={`${currentStatus?.color} rounded-lg text-xs font-medium ${isUpdating ? 'opacity-50' : ''}`}>
              {isUpdating ? '...' : currentStatus?.label}
            </Badge>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {statusOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              <div className="flex items-center gap-2">
                <Badge className={`${option.color} rounded-lg text-xs font-medium`}>
                  {option.label}
                </Badge>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Erfolgs-Meldung */}
      {showSuccess && (
        <Alert className="absolute top-10 left-0 z-50 w-64 border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-800 rounded-xl">
          <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
          <AlertDescription className="text-green-800 dark:text-green-200 text-xs">
            Status erfolgreich aktualisiert
          </AlertDescription>
        </Alert>
      )}

      {/* Fehler-Meldung */}
      {showError && (
        <Alert className="absolute top-10 left-0 z-50 w-64 border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 rounded-xl">
          <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
          <AlertDescription className="text-red-800 dark:text-red-200 text-xs">
            {errorMessage}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
} 