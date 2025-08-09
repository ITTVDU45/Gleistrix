const WebSocket = require('ws');
const http = require('http');

const server = http.createServer();
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const wss = new WebSocket.Server({ server });

// Speichere verbundene Benutzer
const connectedUsers = new Map();

// Speichere aktive Sperren
const activeLocks = new Map();

wss.on('connection', (ws, req) => {
  console.log('User connected');
  
  // Benutzer-ID aus URL-Parametern extrahieren
  const url = new URL(req.url, `http://${req.headers.host}`);
  const userId = url.searchParams.get('userId');
  
  if (userId) {
    connectedUsers.set(ws, userId);
    console.log('User authenticated:', userId);
    
    // Sende Bestätigung an den Client
    ws.send(JSON.stringify({
      type: 'connection-established',
      userId,
      timestamp: new Date().toISOString()
    }));
  }

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      console.log('[WebSocket] Nachricht empfangen:', data);
      
      // Identifikations-Nachrichten verarbeiten
      if (data.type === 'identify' && data.userId) {
        connectedUsers.set(ws, data.userId);
        console.log('User re-identified:', data.userId);
        return;
      }
      
      // Lock-spezifische Nachrichten verarbeiten
      if (data.type === 'lock-acquired' && data.resourceType && data.resourceId) {
        // Speichere die aktive Sperre
        const lockKey = `${data.resourceType}:${data.resourceId}`;
        activeLocks.set(lockKey, {
          userId: connectedUsers.get(ws),
          timestamp: new Date().toISOString()
        });
        console.log(`[WebSocket] Sperre erworben: ${lockKey} von ${connectedUsers.get(ws)}`);
      }
      
      if (data.type === 'lock-released' && data.resourceType && data.resourceId) {
        // Entferne die Sperre
        const lockKey = `${data.resourceType}:${data.resourceId}`;
        activeLocks.delete(lockKey);
        console.log(`[WebSocket] Sperre freigegeben: ${lockKey} von ${connectedUsers.get(ws)}`);
      }
      
      // Sende Update an alle anderen verbundenen Benutzer
      wss.clients.forEach((client) => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          console.log('[WebSocket] Sende Broadcast an Client:', data);
          client.send(JSON.stringify({
            ...data,
            fromUserId: connectedUsers.get(ws)
          }));
        }
      });
    } catch (error) {
      console.error('[WebSocket] Fehler beim Parsen der Nachricht:', error);
    }
  });

  ws.on('close', () => {
    const userId = connectedUsers.get(ws);
    console.log('User disconnected:', userId);
    
    // Prüfe, ob der Benutzer aktive Sperren hatte
    if (userId) {
      // Finde alle Sperren des Benutzers
      const userLocks = [];
      activeLocks.forEach((lockInfo, lockKey) => {
        if (lockInfo.userId === userId) {
          userLocks.push(lockKey);
        }
      });
      
      // Gib alle Sperren des Benutzers frei und benachrichtige andere
      userLocks.forEach(lockKey => {
        const [resourceType, resourceId] = lockKey.split(':');
        activeLocks.delete(lockKey);
        
        console.log(`[WebSocket] Auto-Freigabe der Sperre: ${lockKey} von ${userId} (Verbindung geschlossen)`);
        
        // Versuche zusätzlich die DB-Sperre per HTTP-API freizugeben (best effort)
        try {
          const body = JSON.stringify({ resourceType, resourceId });
          // Node >=18 hat global fetch
          if (typeof fetch === 'function') {
            fetch(`${APP_URL}/api/locks/release`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body
            }).then(res => {
              if (!res.ok) {
                console.log('[WebSocket] API-Freigabe fehlgeschlagen:', res.status);
              }
            }).catch(err => {
              console.log('[WebSocket] API-Freigabe Fehler:', err.message);
            });
          }
        } catch (e) {
          console.log('[WebSocket] Konnte API-Freigabe nicht ausführen:', e.message);
        }

        // Benachrichtige andere Benutzer über die Freigabe
        wss.clients.forEach((client) => {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
              type: 'lock-released',
              resourceType,
              resourceId,
              fromUserId: userId,
              reason: 'disconnected',
              timestamp: new Date().toISOString()
            }));
          }
        });
      });
    }
    
    connectedUsers.delete(ws);
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

const PORT = process.env.WS_PORT || 3001;
server.listen(PORT, () => {
  console.log(`WebSocket server running on port ${PORT}`);
}); 