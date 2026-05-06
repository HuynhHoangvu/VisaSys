// src/socket.ts
import { Server } from "socket.io";
import type { Server as HTTPServer } from "http";
import { getCorsOrigins } from "../config/env.js";

let io: Server;

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
  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error("Socket.io chưa được khởi tạo!");
  }
  return io;
};