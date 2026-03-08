// src/server.ts
import http from "http";
import app from "./app.js"; 
import { initSocket } from "./socket.js"; 

const PORT = process.env.PORT || 3001;

const server = http.createServer(app);
const io = initSocket(server);

io.on("connection", (socket) => {
  console.log("⚡ Một client vừa kết nối:", socket.id);
});

// SỬA LẠI ĐOẠN NÀY: Thêm "0.0.0.0"
server.listen(Number(PORT), "0.0.0.0", () => {
  console.log(`🚀 Backend CRM Real-time đang chạy tại port: ${PORT}`);
});