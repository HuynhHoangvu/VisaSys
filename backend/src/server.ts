import http from "http";
import app from "./app.js";
import { initSocket } from "./socket.js";
import { scheduleAttendanceJobs } from "./jobs/attendance.job.js";
import { PORT } from "../config/env.js";

const server = http.createServer(app);
const io = initSocket(server);

scheduleAttendanceJobs();

io.on("connection", (socket) => {
  console.log("⚡ Một client vừa kết nối:", socket.id);
});

server.listen(Number(PORT), "0.0.0.0", () => {
  console.log(`🚀 Backend CRM Real-time đang chạy tại port: ${PORT}`);
});
