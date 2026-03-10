// src/server.ts
import http from "http";
import app from "./app.js"; 
import { initSocket } from "./socket.js"; 

const PORT = process.env.PORT || 3001;

const server = http.createServer(app);
initSocket(server);

server.listen(Number(PORT), "0.0.0.0", () => {
  console.log(`🚀 Backend CRM Real-time đang chạy tại port: ${PORT}`);
});