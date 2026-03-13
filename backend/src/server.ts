// src/server.ts
import "dotenv/config"; 
import http from "http";
import app from "./app.js"; 
import { initSocket } from "./socket.js"; 
import cron from "node-cron"
import { penalizeForgotCheckout } from "./controllers/hr.controller.js";
const PORT = process.env.PORT || 3001;

const server = http.createServer(app);
const io = initSocket(server);
cron.schedule("59 23 * * *", async () => {
  console.log("⏰ Đang xử lý quên check-out...");
  // Gọi thẳng prisma logic, không cần fake req/res
  await penalizeForgotCheckout(
    {} as any,
    {
      json: (data: any) => console.log("✅ Kết quả:", data),
      status: () => ({ json: (e: any) => console.error("❌ Lỗi:", e) }),
    } as any,
  );
});
io.on("connection", (socket) => {
  console.log("⚡ Một client vừa kết nối:", socket.id);
});

// SỬA LẠI ĐOẠN NÀY: Thêm "0.0.0.0"
server.listen(Number(PORT), "0.0.0.0", () => {
  console.log(`🚀 Backend CRM Real-time đang chạy tại port: ${PORT}`);
});