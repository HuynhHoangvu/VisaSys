// src/socket.ts
import { Server, Socket } from "socket.io";
import type { Server as HTTPServer } from "http";
import { getCorsOrigins } from "../config/env.js";
import { prisma } from "../lib/prisma.js";

let io: Server;

// Track online users per room: roomId -> Set<{socketId, userId, name}>
const roomOnlineUsers = new Map<string, Map<string, { userId: string; name: string }>>();

function getRoomOnlineList(roomId: string) {
  const map = roomOnlineUsers.get(roomId);
  if (!map) return [];
  return Array.from(map.values());
}

async function handleChatSocket(socket: Socket) {
  const userId: string = socket.data.userId;
  const userName: string = socket.data.userName;
  const departmentId: string | undefined = socket.data.departmentId;

  // chat:join — client joins their department room
  socket.on("chat:join", async (roomId: string) => {
    socket.join(roomId);

    if (!roomOnlineUsers.has(roomId)) {
      roomOnlineUsers.set(roomId, new Map());
    }
    roomOnlineUsers.get(roomId)!.set(socket.id, { userId, name: userName });

    // Broadcast updated online list
    io.to(roomId).emit("chat:online", getRoomOnlineList(roomId));
  });

  // chat:message — client sends a message
  socket.on("chat:message", async (data: { roomId: string; content: string }) => {
    if (!data.roomId || !data.content?.trim()) return;

    try {
      // Verify user belongs to this room
      const room = await prisma.chatRoom.findUnique({ where: { id: data.roomId } });
      if (!room) return;
      if (room.departmentId && room.departmentId !== departmentId) return;

      const message = await prisma.chatMessage.create({
        data: {
          content: data.content.trim(),
          senderId: userId,
          senderName: userName,
          roomId: data.roomId,
        },
      });

      io.to(data.roomId).emit("chat:message:new", message);
    } catch (err) {
      console.error("[chat] Error saving message:", err);
    }
  });

  // chat:typing
  socket.on("chat:typing", (data: { roomId: string; isTyping: boolean }) => {
    socket.to(data.roomId).emit("chat:typing:update", {
      userId,
      name: userName,
      isTyping: data.isTyping,
    });
  });

  socket.on("disconnect", () => {
    roomOnlineUsers.forEach((users, roomId) => {
      if (users.has(socket.id)) {
        users.delete(socket.id);
        io.to(roomId).emit("chat:online", getRoomOnlineList(roomId));
      }
    });
  });
}

export const initSocket = (server: HTTPServer) => {
  io = new Server(server, {
    cors: {
      origin: (origin, cb) => {
        const allowed = getCorsOrigins();
        if (!origin || allowed.includes(origin)) cb(null, true);
        else cb(null, false);
      },
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    console.log("⚡ Một client vừa kết nối:", socket.id);

    // Attach user info from handshake auth
    const auth = socket.handshake.auth;
    socket.data.userId = auth.userId ?? "anonymous";
    socket.data.userName = auth.userName ?? "Ẩn danh";
    socket.data.departmentId = auth.departmentId;

    handleChatSocket(socket);
  });

  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error("Socket.io chưa được khởi tạo!");
  }
  return io;
};
