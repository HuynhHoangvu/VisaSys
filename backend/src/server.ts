import http from "http";
import app from "./app.js";
import { initSocket } from "./socket.js";
import { scheduleAttendanceJobs } from "./jobs/attendance.job.js";
import { PORT } from "../config/env.js";

// ── Process-level safety nets ────────────────────────────────────────────────
// These must be registered before any async work so that errors which escape
// try/catch blocks (e.g. inside imported modules or promise chains) are always
// surfaced in the deployment logs rather than causing a silent exit.

process.on("uncaughtException", (err) => {
  console.error("❌ [uncaughtException] Unhandled exception — server will exit:", err);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  console.error("❌ [unhandledRejection] Unhandled promise rejection — server will exit:", reason);
  process.exit(1);
});

// ── Server bootstrap ─────────────────────────────────────────────────────────

async function bootstrap(): Promise<void> {
  // 1. Create HTTP server from Express app
  let server: http.Server;
  try {
    server = http.createServer(app);
    /** Allow long multipart uploads (Node default request timeout can drop large/slow requests). */
    server.requestTimeout = 0;
    server.headersTimeout = 120_000;
    console.log("✅ HTTP server created");
  } catch (err) {
    console.error("❌ Failed to create HTTP server:", err);
    process.exit(1);
  }

  // 2. Initialise Socket.io
  try {
    const io = initSocket(server);
    io.on("connection", (socket) => {
      console.log("⚡ Một client vừa kết nối:", socket.id);
    });
    console.log("✅ Socket.io initialised");
  } catch (err) {
    console.error("❌ Failed to initialise Socket.io:", err);
    process.exit(1);
  }

  // 3. Schedule background jobs
  try {
    scheduleAttendanceJobs();
    console.log("✅ Attendance cron jobs scheduled");
  } catch (err) {
    console.error("❌ Failed to schedule attendance jobs:", err);
    process.exit(1);
  }

  // 4. Start listening
  await new Promise<void>((resolve, reject) => {
    server.listen(Number(PORT), "0.0.0.0", () => {
      console.log(`🚀 Backend CRM Real-time đang chạy tại port: ${PORT}`);
      resolve();
    });
    server.on("error", (err) => {
      console.error("❌ Failed to bind server to port:", err);
      reject(err);
    });
  });
}

bootstrap().catch((err) => {
  console.error("❌ Fatal error during server bootstrap:", err);
  process.exit(1);
});
