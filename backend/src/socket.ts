// src/socket.ts
import { Server } from "socket.io";
import type { Server as HTTPServer } from "http";

let io: Server;

export const initSocket = (server: HTTPServer) => {
  io = new Server(server, {
    cors: {
      origin: [
        "http://localhost:5173",
        "http://localhost:5174",
        "https://flyvisa.up.railway.app",
        process.env.FRONTEND_URL,
      ].filter((o): o is string => Boolean(o)),
      methods: ["GET", "POST", "PUT", "DELETE"],
      credentials: true,
    },
  });
  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error("Socket.io chưa được khởi tạo!");
  }
  return io;
};