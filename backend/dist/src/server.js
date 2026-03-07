// src/server.ts
import http from "http";
import app from "./app.js"; // Import app bình thường
import { initSocket } from "./socket.js"; // Import hàm khởi tạo Socket
const PORT = process.env.PORT || 3001;
// 1. Tạo HTTP Server bọc thẳng Express App (app) vào đây
const server = http.createServer(app);
// 2. Khởi tạo Socket.io từ server
const io = initSocket(server);
io.on("connection", (socket) => {
    console.log("⚡ Một client vừa kết nối:", socket.id);
});
// 3. Khởi động server
server.listen(PORT, () => {
    console.log(`🚀 Backend CRM Real-time đang chạy tại: http://localhost:${PORT}`);
});
