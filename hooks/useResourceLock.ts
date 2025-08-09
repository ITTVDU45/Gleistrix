'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { lockWebSocket } from '../lib/websocket';
import { fetchWithIntent } from '@/lib/http/fetchWithIntent';
import { LocksApi } from '@/lib/api/locks';

interface LockInfo {
  isLocked: boolean;
  isOwnLock: boolean;
  lockedBy?: {
    name: string;
    role: string;
    lockedAt: string;
    lastActivity: string;
  };
}

interface UseResourceLockOptions {
  resourceType: 'project' | 'employee' | 'vehicle';
  resourceId: string;
  autoAcquire?: boolean;
  autoRelease?: boolean;
  activityInterval?: number; // in Sekunden
  checkInterval?: number; // in Sekunden - kontinuierliche Prüfung
  lazyLoad?: boolean; // Neue Option für Lazy Loading
  onLockAcquired?: () => void;
  onLockReleased?: () => void;
  onLockLost?: () => void;
  userId?: string; // Benutzer-ID für WebSocket
}

export function useResourceLock({
  resourceType,
  resourceId,
  autoAcquire = true,
  autoRelease = true,
  activityInterval = 30, // 30 Sekunden
  checkInterval = 10, // 10 Sekunden für kontinuierliche Prüfung
  lazyLoad = false, // Lazy Loading standardmäßig deaktiviert
  onLockAcquired,
  onLockReleased,
  onLockLost,
  userId
}: UseResourceLockOptions) {
  const [lockInfo, setLockInfo] = useState<LockInfo>({
    isLocked: false,
    isOwnLock: false
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const activityIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isOwnLockRef = useRef(false);
  const previousLockState = useRef<{ isLocked: boolean; isOwnLock: boolean }>({
    isLocked: false,
    isOwnLock: false
  });
  const isReleasingRef = useRef(false); // Verhindert Mehrfach-Freigabe
  const lastCheckTime = useRef<number>(0); // Verhindert zu häufige Prüfungen
  const [isAcquiring, setIsAcquiring] = useState(false);
  const isAcquiringRef = useRef(false);

  // Sperrstatus prüfen (verbessert) mit Rückgabe des aktuellen Status
  const checkLock = useCallback(async (force = false) => {
    if (!resourceId) return { isLocked: false, isOwnLock: false };
    
    // Verhindere zu häufige Prüfungen (mindestens 5 Sekunden Abstand)
    const now = Date.now();
    if (!force && now - lastCheckTime.current < 5000) {
      return { 
        isLocked: lockInfo.isLocked, 
        isOwnLock: lockInfo.isOwnLock,
        lockedBy: lockInfo.lockedBy
      }; // Aktuellen Status zurückgeben
    }
    lastCheckTime.current = now;
    
    try {
      const data = await LocksApi.check(resourceType, resourceId);
      
      if (data.success) {
        const newLockState: LockInfo = {
          isLocked: data.isLocked,
          isOwnLock: data.isOwnLock,
          lockedBy: data.lock
            ? {
                name: data.lock.lockedBy.name,
                role: data.lock.lockedBy.role,
                lockedAt: data.lock.lockedAt,
                lastActivity: data.lock.lastActivity,
              }
            : undefined,
        };
        
        // Prüfen, ob sich der Sperrstatus geändert hat
        const lockStateChanged = 
          previousLockState.current.isLocked !== newLockState.isLocked ||
          previousLockState.current.isOwnLock !== newLockState.isOwnLock;
        
        setLockInfo(newLockState);
        isOwnLockRef.current = data.isOwnLock;
        previousLockState.current = {
          isLocked: data.isLocked,
          isOwnLock: data.isOwnLock
        };
        
        // Nur bei tatsächlichen Änderungen Callbacks aufrufen
        if (lockStateChanged) {
          if (newLockState.isOwnLock && !previousLockState.current.isOwnLock) {
            onLockAcquired?.();
          } else if (!newLockState.isOwnLock && previousLockState.current.isOwnLock) {
            onLockReleased?.();
          } else if (newLockState.isLocked && !newLockState.isOwnLock && previousLockState.current.isOwnLock) {
            onLockLost?.();
          }
        }
        
        setIsInitialized(true);
        
        // Aktuellen Status zurückgeben
        return newLockState;
      } else {
        setError((data as any).error || 'Fehler beim Prüfen der Sperre');
        return { 
          isLocked: lockInfo.isLocked, 
          isOwnLock: lockInfo.isOwnLock,
          lockedBy: lockInfo.lockedBy
        };
      }
    } catch (err: any) {
      console.error('Fehler beim Prüfen der Sperre:', err);
      setError('Fehler beim Prüfen der Sperre');
      return { 
        isLocked: lockInfo.isLocked, 
        isOwnLock: lockInfo.isOwnLock,
        lockedBy: lockInfo.lockedBy
      };
    }
  }, [resourceType, resourceId, onLockAcquired, onLockReleased, onLockLost, lockInfo]);

  // Sperre erwerben (verbessert mit Race Condition Schutz)
  const acquireLock = useCallback(async () => {
    if (!resourceId || isAcquiringRef.current) return false;
    setIsAcquiring(true);
    isAcquiringRef.current = true;
    setError(null);
    setIsLoading(true);
    try {
      const data = await LocksApi.acquire(resourceType, resourceId);
      if (data.success) {
        const newLockState: LockInfo = {
          isLocked: true,
          isOwnLock: true,
          lockedBy: data.lock
            ? {
                name: data.lock.lockedBy.name,
                role: data.lock.lockedBy.role,
                lockedAt: new Date().toISOString(),
                lastActivity: new Date().toISOString(),
              }
            : undefined,
        };
        setLockInfo(newLockState);
        isOwnLockRef.current = true;
        previousLockState.current = { isLocked: true, isOwnLock: true };
        // WebSocket-Event senden (best effort)
        try {
          if (lockWebSocket.isWebSocketAvailable()) {
            lockWebSocket.emitLockUpdate(resourceType, resourceId, 'acquired');
          }
        } catch (e) {
          // still proceed silently
        }
        onLockAcquired?.();
        return true;
      } else {
        setError((data as any).error || 'Fehler beim Erwerben der Sperre');
        if ((data as any).lockedBy) {
          const newLockState: LockInfo = {
            isLocked: true,
            isOwnLock: false,
            lockedBy: {
              name: (data as any).lockedBy.name,
              role: (data as any).lockedBy.role,
              lockedAt: new Date().toISOString(),
              lastActivity: new Date().toISOString(),
            },
          };
          setLockInfo(newLockState);
          previousLockState.current = { isLocked: true, isOwnLock: false };
        }
        return false;
      }
    } catch (err) {
      console.error('Fehler beim Erwerben der Sperre:', err);
      setError('Fehler beim Erwerben der Sperre');
      return false;
    } finally {
      setIsAcquiring(false);
      isAcquiringRef.current = false;
      setIsLoading(false);
    }
  }, [resourceType, resourceId, onLockAcquired]);

  // Sperre freigeben (verbessert)
  const releaseLock = useCallback(async () => {
    if (!resourceId || isReleasingRef.current) return false; // Verhindere Mehrfach-Freigabe
    
    isReleasingRef.current = true;
    
    try {
      const data = await LocksApi.release(resourceType, resourceId);
      
      if (data.success) {
        const newLockState = {
          isLocked: false,
          isOwnLock: false
        };
        
        setLockInfo(newLockState);
        isOwnLockRef.current = false;
        previousLockState.current = {
          isLocked: false,
          isOwnLock: false
        };
        // WebSocket-Event senden (best effort)
        try {
          if (lockWebSocket.isWebSocketAvailable()) {
            lockWebSocket.emitLockUpdate(resourceType, resourceId, 'released');
          }
        } catch (e) {
          // ignore
        }
        
        onLockReleased?.();
        return true;
      } else {
        setError((data as any).error || 'Fehler beim Freigeben der Sperre');
        return false;
      }
    } catch (err: any) {
      console.error('Fehler beim Freigeben der Sperre:', err);
      setError('Fehler beim Freigeben der Sperre');
      return false;
    } finally {
      isReleasingRef.current = false;
    }
  }, [resourceType, resourceId, onLockReleased]);

  // Aktivität aktualisieren
  const updateActivity = useCallback(async () => {
    if (!resourceId || !isOwnLockRef.current) return;
    
    try {
      await LocksApi.updateActivity(resourceType, resourceId);
    } catch (err: any) {
      console.error('Fehler beim Aktualisieren der Aktivität:', err);
    }
  }, [resourceType, resourceId]);

  // Aktivitäts-Intervall starten
  const startActivityInterval = useCallback(() => {
    if (activityIntervalRef.current) {
      clearInterval(activityIntervalRef.current);
    }
    
    activityIntervalRef.current = setInterval(() => {
      if (isOwnLockRef.current) {
        updateActivity();
      }
    }, activityInterval * 1000);
  }, [updateActivity, activityInterval]);

  // Aktivitäts-Intervall stoppen
  const stopActivityInterval = useCallback(() => {
    if (activityIntervalRef.current) {
      clearInterval(activityIntervalRef.current);
      activityIntervalRef.current = null;
    }
  }, []);

  // Kontinuierliche Sperrprüfung starten (für alle Benutzer)
  const startCheckInterval = useCallback(() => {
    if (checkIntervalRef.current) {
      clearInterval(checkIntervalRef.current);
    }
    
    // Immer starten wenn checkInterval > 0, unabhängig vom Sperrstatus
    if (checkInterval > 0) {
      checkIntervalRef.current = setInterval(() => {
        // Prüfen nur, wenn keine eigene Sperre, um Rauschen zu reduzieren
        if (!isOwnLockRef.current && !isAcquiringRef.current) {
          checkLock();
        }
      }, Math.max(checkInterval, 15) * 1000); // Minimum 15s, um Terminal-Rauschen zu minimieren
    }
  }, [checkLock, checkInterval]);

  // Kontinuierliche Sperrprüfung stoppen
  const stopCheckInterval = useCallback(() => {
    if (checkIntervalRef.current) {
      clearInterval(checkIntervalRef.current);
      checkIntervalRef.current = null;
    }
  }, []);

  // Initialisierung (vereinfacht)
  useEffect(() => {
    if (resourceId) {
      if (!lazyLoad) {
        // Sofortige Prüfung einmalig
      checkLock(true);
        // Starte Intervall nur, wenn keine eigene Sperre
        if (!isOwnLockRef.current) startCheckInterval();
      }
    }
    return () => {
      stopActivityInterval();
      stopCheckInterval();
    };
  }, [resourceId, lazyLoad]);

  // Aktivitäts-Intervall verwalten
  useEffect(() => {
    if (lockInfo.isOwnLock) {
      startActivityInterval();
    } else {
      stopActivityInterval();
    }
    
    // Kontinuierliche Prüfung nur, wenn nicht im Lazy-Modus
    if (!lazyLoad) startCheckInterval();
    
    return () => {
      stopActivityInterval();
    };
  }, [lockInfo.isOwnLock, startActivityInterval, stopActivityInterval, startCheckInterval, lazyLoad]);

  // Automatisches Freigeben beim Verlassen der Seite (nur beim tatsächlichen Verlassen)
  useEffect(() => {
    const handlePageHide = (event: PageTransitionEvent) => {
      // Verhindere Freigabe bei bfcache (persisted) oder wenn die Seite nur eingefroren wird
      // und nur freigeben, wenn Tab wirklich verborgen wird
      const isPersisted = (event as any)?.persisted === true;
      const isHidden = typeof document !== 'undefined' ? document.visibilityState === 'hidden' : true;
      if (autoRelease && isOwnLockRef.current && !isReleasingRef.current && !isPersisted && isHidden) {
        console.log('[Lock] Sende Sperre-Freigabe per sendBeacon (pagehide)', { resourceType, resourceId });
        try {
          const blob = new Blob([JSON.stringify({ resourceType, resourceId })], { type: 'application/json' });
          navigator.sendBeacon('/api/locks/release', blob);
        } catch (e) {
          // Fallback: fetch mit keepalive
          fetch('/api/locks/release', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ resourceType, resourceId }),
            keepalive: true
          }).catch(() => {});
        }
      } else {
        console.log('[Lock] Kein Freigeben nötig beim Verlassen', {
          autoRelease,
          isOwnLock: isOwnLockRef.current,
          isReleasing: isReleasingRef.current,
          resourceType,
          resourceId,
          isPersisted,
          isHidden
        });
      }
    };
    window.addEventListener('pagehide', handlePageHide as any);
    return () => {
      window.removeEventListener('pagehide', handlePageHide as any);
    };
  }, [autoRelease, resourceType, resourceId]);

  // Automatischer Erwerb nach Freigabe komplett deaktiviert
  // Wir wollen keine automatische Sperrerwerbung nach Freigabe mehr
  // Stattdessen muss der Benutzer explizit die Sperre erwerben
  
  // Der alte Effekt wurde entfernt:
  // useEffect(() => {
  //   if (autoAcquire && !lockInfo.isLocked && !lockInfo.isOwnLock && isInitialized && !isAcquiringRef.current) {
  //     const timer = setTimeout(() => {
  //       if (!isAcquiringRef.current && !isOwnLockRef.current && !lockInfo.isLocked) {
  //         console.log('Automatischer Erwerb nach Statusänderung');
  //         acquireLock();
  //       } else {
  //         console.log('Automatischer Erwerb übersprungen - Status hat sich geändert');
  //       }
  //     }, 3000);
  //     
  //     return () => clearTimeout(timer);
  //   }
  // }, [lockInfo.isLocked, lockInfo.isOwnLock, isInitialized, acquireLock, autoAcquire]);

  // Sichtbarkeitswechsel: Polling pausieren, wenn Tab/Seite versteckt, und fortsetzen wenn sichtbar
  useEffect(() => {
    const handleVisibility = () => {
      if (typeof document === 'undefined') return;
      if (document.visibilityState === 'hidden') {
        stopCheckInterval();
      } else {
        startCheckInterval();
      }
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibility);
    }
    return () => {
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibility);
      }
    };
  }, [startCheckInterval, stopCheckInterval]);

  // WebSocket-Verbindung herstellen (optional)
  useEffect(() => {
    if (userId && !lockWebSocket.isWebSocketAvailable()) {
      try {
        lockWebSocket.connect(userId);
        // WebSocket-Listener für Lock-Updates
        const handleLockUpdate = (data: any) => {
          if (data.resourceType === resourceType && data.resourceId === resourceId) {
            checkLock(true);
          }
        };
        // Verbesserte lock-released handler - Status aktualisieren und Benutzer informieren
        const handleLockReleased = (data: any) => {
          if (data.resourceType === resourceType && data.resourceId === resourceId) {
            console.log('WebSocket lock released event received:', data);
            
            // Status sofort prüfen, um UI zu aktualisieren
            setTimeout(() => {
              checkLock(true).then((status) => {
                console.log('Lock status updated after WebSocket release notification:', status);
                
                // Hier könnten wir eine Benachrichtigung anzeigen, dass die Sperre freigegeben wurde
                // z.B. über einen Toast/Snackbar oder ein Event-System
                // Wir verwenden die bestehenden Callbacks
                if (!status.isLocked) {
                  console.log('Resource is now available after release!');
                  // Optional: Callback aufrufen, wenn definiert
                  onLockReleased?.();
                }
              });
            }, 500);
          }
        };
        const handleLockAcquired = (data: any) => {
          if (data.resourceType === resourceType && data.resourceId === resourceId) {
            checkLock(true);
          }
        };
        lockWebSocket.subscribe('lock-update', handleLockUpdate);
        lockWebSocket.subscribe('lock-released', handleLockReleased);
        lockWebSocket.subscribe('lock-acquired', handleLockAcquired);
        return () => {
          lockWebSocket.unsubscribe('lock-update', handleLockUpdate);
          lockWebSocket.unsubscribe('lock-released', handleLockReleased);
          lockWebSocket.unsubscribe('lock-acquired', handleLockAcquired);
          // Wichtig: Hier NICHT freigeben, da dieser Cleanup auch bei Re-Renders/Dependency-Änderungen läuft
        };
      } catch (error) {
        console.log('WebSocket not available, using HTTP polling fallback');
        // Fallback: Kontinuierliche HTTP-Polling
        const timer = setInterval(() => {
          if (!lockInfo.isOwnLock) {
            checkLock(true);
          }
        }, 5000);
        
        return () => {
          clearInterval(timer);
          // Hier ebenfalls KEINE Freigabe erzwingen
        };
      }
    }
  }, [userId, resourceType, resourceId]);

  return {
    lockInfo,
    isLoading,
    error,
    acquireLock,
    releaseLock,
    checkLock,
    updateActivity
  };
} 