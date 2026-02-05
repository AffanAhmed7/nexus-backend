// Must be first to load environment variables
import "dotenv/config";

import http from "http";
import app from "./app.js"; // Your Express app
import { Server } from "socket.io";

// Import Prisma to ensure it initializes on server start
import prisma from "./config/db.js";
import { initScheduler } from "./utils/scheduler.js";

const PORT = process.env.PORT || 5000;

// Create HTTP server
const server = http.createServer(app);

// Setup Socket.io
const io = new Server(server, {
  cors: {
    origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"],
    methods: ["GET", "POST"],
    credentials: true
  },
});

// Track online users per project - storing objects with id and name
const projectPresence: { [projectId: string]: Map<string, string> } = {};
const userSockets: { [socketId: string]: { userId: string; projectId: string } } = {};

io.on("connection", (socket) => {

  socket.on("join-project", ({ projectId, userId, name }) => {
    socket.join(projectId);
    socket.join(`user_${userId}`);

    if (!projectPresence[projectId]) {
      projectPresence[projectId] = new Map();
    }
    projectPresence[projectId].set(userId, name || 'User');
    userSockets[socket.id] = { userId, projectId };

    // Broadcast updated presence as array of objects
    const presenceArray = Array.from(projectPresence[projectId].entries()).map(([id, name]) => ({
      id,
      name,
      initials: name.split(' ').map((n: any) => n[0]).join('').toUpperCase()
    }));
    io.to(projectId).emit("presence_updated", presenceArray);
  });

  socket.on("join-workspace", ({ workspaceId }) => {
    socket.join(workspaceId);
  });

  socket.on("disconnect", () => {
    const info = userSockets[socket.id];
    if (info) {
      const { userId, projectId } = info;
      projectPresence[projectId]?.delete(userId);
      delete userSockets[socket.id];

      const presenceArray = Array.from(projectPresence[projectId]?.entries() || []).map(([id, name]) => ({
        id,
        name,
        initials: name.split(' ').map((n: any) => n[0]).join('').toUpperCase()
      }));

      io.to(projectId).emit("presence_updated", presenceArray);
    }
  });
});

// Export io to be used in controllers
export { io };

// Start the server
server.listen(PORT, async () => {
  try {
    // Test Prisma connection
    await prisma.$connect();
    // Start Scheduler
    initScheduler();
    console.log("🚀 Scheduler initialized");
  } catch (err) {
    console.error("❌ Prisma failed to connect:", err);
    process.exit(1);
  }

});
