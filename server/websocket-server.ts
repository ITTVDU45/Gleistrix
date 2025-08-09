import { Server } from 'socket.io';
import { createServer } from 'http';

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Speichere verbundene Benutzer
const connectedUsers = new Map<string, string>();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  const userId = socket.handshake.auth.userId;
  if (userId) {
    connectedUsers.set(socket.id, userId);
    console.log('User authenticated:', userId);
  }

  socket.on('lock-update', (data) => {
    console.log('Lock update received:', data);
    
    // Sende Update an alle anderen verbundenen Benutzer
    socket.broadcast.emit('lock-update', {
      ...data,
      userId: connectedUsers.get(socket.id)
    });
  });

  socket.on('lock-released', (data) => {
    console.log('Lock released received:', data);
    
    // Sende Release an alle anderen verbundenen Benutzer
    socket.broadcast.emit('lock-released', {
      ...data,
      userId: connectedUsers.get(socket.id)
    });
  });

  socket.on('lock-acquired', (data) => {
    console.log('Lock acquired received:', data);
    
    // Sende Acquire an alle anderen verbundenen Benutzer
    socket.broadcast.emit('lock-acquired', {
      ...data,
      userId: connectedUsers.get(socket.id)
    });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    connectedUsers.delete(socket.id);
  });
});

const PORT = process.env.WS_PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`WebSocket server running on port ${PORT}`);
});

export { io }; 