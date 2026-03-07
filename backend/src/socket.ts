// src/socket.ts
import { Server } from "socket.io";
import type { Server as HTTPServer } from "http";

let io: Server;

export const initSocket = (server: HTTPServer) => {
  io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
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