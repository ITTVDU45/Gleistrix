'use client';
import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './dialog';
import { Button } from './button';
import { Alert, AlertDescription } from './alert';
import { AlertTriangle, Lock, User, Clock, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

interface ResourceLockDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onRetry: () => void;
  lockInfo: {
    isLocked: boolean;
    isOwnLock: boolean;
    lockedBy?: {
      name: string;
      role: string;
      lockedAt: string;
      lastActivity: string;
    };
  };
  resourceType: 'project' | 'employee' | 'vehicle';
  resourceName?: string;
  blockPage?: boolean; // Wird nicht mehr verwendet, nur für Abwärtskompatibilität
}

export function ResourceLockDialog({
  isOpen,
  onClose,
  onRetry,
  lockInfo,
  resourceType,
  resourceName,
  blockPage = false // Wird nicht mehr verwendet
}: ResourceLockDialogProps) {
  const [isRetrying, setIsRetrying] = useState(false);

  const getResourceTypeLabel = (type: string) => {
    switch (type) {
      case 'project': return 'Projekt';
      case 'employee': return 'Mitarbeiter';
      case 'vehicle': return 'Fahrzeug';
      default: return type;
    }
  };

  const formatTime = (dateString: string) => {
    try {
      return format(new Date(dateString), 'dd.MM.yyyy HH:mm', { locale: de });
    } catch {
      return dateString;
    }
  };

  const getTimeAgo = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      
      if (diffMins < 1) return 'gerade eben';
      if (diffMins === 1) return 'vor 1 Minute';
      if (diffMins < 60) return `vor ${diffMins} Minuten`;
      
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours === 1) return 'vor 1 Stunde';
      return `vor ${diffHours} Stunden`;
    } catch {
      return 'unbekannt';
    }
  };

  // Verbesserte Retry-Funktion mit Feedback
  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      // Kurze Verzögerung für bessere UX
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Callback für erneuten Versuch ausführen
      await onRetry();
      
      // Hinweis: Die Anzeige des Dialogs wird durch die Bedingung
      // in der übergeordneten Komponente gesteuert (isOpen={lockDialogOpen && lockInfo.isLocked && !lockInfo.isOwnLock})
      // Wenn die Sperre freigegeben wurde, wird der Dialog automatisch geschlossen
    } finally {
      setIsRetrying(false);
    }
  };

  // Wir verwenden jetzt immer das Dialog-Fenster, unabhängig von blockPage
  // blockPage wird nicht mehr verwendet, da wir nur bei bestimmten Aktionen blockieren wollen

  // Nur Dialog anzeigen, wenn eine Sperre existiert und es nicht die eigene ist
  if (!lockInfo.isLocked || lockInfo.isOwnLock || !isOpen) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-orange-500" />
            {getResourceTypeLabel(resourceType)} ist gesperrt
          </DialogTitle>
          <DialogDescription>
            {resourceName ? (
              <>
                Der {getResourceTypeLabel(resourceType).toLowerCase()} <strong>"{resourceName}"</strong> wird derzeit von einem anderen Benutzer bearbeitet.
              </>
            ) : (
              <>
                Dieser {getResourceTypeLabel(resourceType).toLowerCase()} wird derzeit von einem anderen Benutzer bearbeitet.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Sie können diese Ressource erst bearbeiten, wenn sie freigegeben wird.
            </AlertDescription>
          </Alert>

          {lockInfo.lockedBy && (
            <div className="space-y-3 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-slate-500" />
                <span className="text-sm font-medium">Gesperrt von:</span>
              </div>
              <div className="ml-6 space-y-1">
                <div className="text-sm">
                  <span className="font-medium">{lockInfo.lockedBy.name}</span>
                  <span className="text-slate-500 ml-2">({lockInfo.lockedBy.role})</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Clock className="h-3 w-3" />
                  <span>Seit {formatTime(lockInfo.lockedBy.lockedAt)}</span>
                  <span>•</span>
                  <span>{getTimeAgo(lockInfo.lockedBy.lastActivity)} aktiv</span>
                </div>
              </div>
            </div>
          )}

          <div className="text-xs text-slate-500 space-y-1">
            <p>• Sperren werden automatisch nach 15 Minuten Inaktivität freigegeben</p>
            <p>• Sie können diese Seite schließen und später erneut versuchen</p>
            <p>• Kontaktieren Sie den Benutzer, falls Sie die Ressource dringend benötigen</p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Schließen
          </Button>
          <Button 
            onClick={handleRetry}
            disabled={isRetrying}
          >
            {isRetrying ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Prüfe...
              </>
            ) : (
              'Erneut versuchen'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 