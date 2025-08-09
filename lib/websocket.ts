class LockWebSocket {
  private socket: WebSocket | null = null;
  private listeners: Map<string, Function[]> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3; // Erhöht auf 3 Versuche
  private isConnected = false;
  private isConnecting = false;
  private userId: string | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;

  connect(userId: string) {
    // Speichere die Benutzer-ID für Reconnect
    this.userId = userId;
    
    // Verhindere mehrfache Verbindungsversuche
    if (this.isConnecting) {
      console.log('WebSocket already connecting');
      return;
    }
    
    // Wenn bereits verbunden, aber mit anderer Benutzer-ID, neu verbinden
    if (this.isConnected && this.socket && this.socket.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected, sending identification');
      try {
        // Sende Identifikation an den Server
        this.socket.send(JSON.stringify({
          type: 'identify',
          userId: userId
        }));
        return;
      } catch (error) {
        console.log('Error sending identification, reconnecting');
        this.socket.close();
      }
    }

    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }

    try {
      this.isConnecting = true;
      const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001';
      console.log('Attempting to connect to WebSocket:', wsUrl, 'with userId:', userId);
      
      this.socket = new WebSocket(`${wsUrl}?userId=${userId}`);

      this.socket.onopen = () => {
        console.log('WebSocket connected successfully');
        this.isConnected = true;
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        
        // Sende Identifikation nach Verbindung
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
          this.socket.send(JSON.stringify({
            type: 'identify',
            userId: userId
          }));
        }
      };

      this.socket.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason);
        this.isConnected = false;
        this.isConnecting = false;
        this.attemptReconnect();
      };

      this.socket.onerror = (error) => {
        console.log('WebSocket connection failed, will attempt reconnect');
        this.isConnected = false;
        this.isConnecting = false;
      };

      this.socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('WebSocket message received:', data);
          this.notifyListeners(data.type, data);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };
    } catch (error) {
      console.log('WebSocket not available, using HTTP polling fallback');
      this.isConnected = false;
      this.isConnecting = false;
    }
  }

  private attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts && this.userId) {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      
      // Abbrechen eines vorherigen Reconnect-Timers
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
      }
      
      // Exponentielles Backoff für Reconnect-Versuche (1s, 2s, 4s)
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 10000);
      
      this.reconnectTimer = setTimeout(() => {
        if (this.userId) {
          this.connect(this.userId);
        }
        this.reconnectTimer = null;
      }, delay);
    } else {
      console.log('Max reconnection attempts reached, using HTTP polling fallback');
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.isConnected = false;
    this.isConnecting = false;
  }

  subscribe(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  unsubscribe(event: string, callback: Function) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  private notifyListeners(event: string, data: any) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => callback(data));
    }
  }

  emitLockUpdate(resourceType: string, resourceId: string, action: 'acquired' | 'released' | 'updated') {
    if (this.socket && this.socket.readyState === WebSocket.OPEN && this.isConnected) {
      console.log('Sending WebSocket lock update:', { resourceType, resourceId, action });
      
      // Bestimme den Event-Typ basierend auf der Aktion
      let eventType = 'lock-update';
      if (action === 'acquired') {
        eventType = 'lock-acquired';
      } else if (action === 'released') {
        eventType = 'lock-released';
      }
      
      // Sende das Event mit allen relevanten Informationen
      this.socket.send(JSON.stringify({
        type: eventType,
        resourceType,
        resourceId,
        action,
        userId: this.userId,
        timestamp: new Date().toISOString()
      }));
      
      // Lokale Benachrichtigung auch senden (für sofortige Reaktion)
      if (action === 'released') {
        this.notifyListeners('lock-released', {
          type: 'lock-released',
          resourceType,
          resourceId,
          userId: this.userId,
          timestamp: new Date().toISOString()
        });
      } else if (action === 'acquired') {
        this.notifyListeners('lock-acquired', {
          type: 'lock-acquired',
          resourceType,
          resourceId,
          userId: this.userId,
          timestamp: new Date().toISOString()
        });
      }
    } else {
      console.log('WebSocket not available for lock update, using HTTP polling');
      
      // Bei fehlender WebSocket-Verbindung trotzdem lokale Benachrichtigung senden
      if (action === 'released') {
        this.notifyListeners('lock-released', {
          type: 'lock-released',
          resourceType,
          resourceId,
          userId: this.userId,
          timestamp: new Date().toISOString()
        });
      }
    }
  }

  isWebSocketAvailable(): boolean {
    return this.isConnected && this.socket !== null && this.socket.readyState === WebSocket.OPEN;
  }
}

export const lockWebSocket = new LockWebSocket(); 