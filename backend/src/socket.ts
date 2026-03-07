// src/socket.ts
import { Server } from "socket.io";
import type { Server as HTTPServer } from "http";

let io: Server;

export const initSocket = (server: HTTPServer) => {
  io = new Server(server, {
    cors: {
      origin: "http://localhost:5173", // Link React của bạn
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