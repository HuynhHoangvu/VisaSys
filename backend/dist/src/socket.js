// src/socket.ts
import { Server } from "socket.io";
let io;
export const initSocket = (server) => {
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
