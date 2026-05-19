import { Server } from 'socket.io';
import { Server as HttpServer } from 'http';

let io: Server;

export const initSocket = (server: HttpServer): Server => {
    const allowedOrigins = process.env.ALLOWED_ORIGINS
        ? process.env.ALLOWED_ORIGINS.split(',').map(item => item.trim())
        : ["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"];

    io = new Server(server, {
        cors: {
            origin: allowedOrigins,
            methods: ["GET", "POST"],
            credentials: true
        },
    });

    const projectPresence: { [projectId: string]: Set<string> } = {};
    const userSockets: { [socketId: string]: { userId: string; projectId: string } } = {};

    io.on("connection", (socket) => {

        socket.on("join-project", ({ projectId, userId, name }) => {
            socket.join(projectId);
            socket.join(`user_${userId}`);

            if (!projectPresence[projectId]) {
                projectPresence[projectId] = new Set();
            }
            projectPresence[projectId].add(userId);
            userSockets[socket.id] = { userId, projectId };

            // Broadcast updated presence
            io.to(projectId).emit("presence_updated", Array.from(projectPresence[projectId]));
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

                io.to(projectId).emit(
                    "presence_updated",
                    Array.from(projectPresence[projectId] || [])
                );
            }
        });
    });

    return io;
};

export const getIO = (): Server => {
    if (!io) {
        throw new Error("Socket.io not initialized!");
    }
    return io;
};
