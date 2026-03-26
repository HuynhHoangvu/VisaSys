// src/app.ts
import "dotenv/config"; 
import express from "express";
import cors from "cors";
import session from "express-session";
import boardRoutes from "./routes/board.routes.js";
import activityRoutes from "./routes/activity.routes.js";
import hrRoutes from "./routes/hr.routes.js";
import notificationRoutes from "./routes/notification.routes.js";
import authRoutes from "./routes/auth.routes.js";
import taskRoutes from "./routes/task.routes.js"; // Thêm dòng này cùng chỗ với các import routes khác
import path from "path";
import docsRoutes from "./routes/docs.routes.js";
import processedDocsRoutes from "./routes/processedDocs.routes.js";
import kpiRoutes from "./routes/kpi.routes.js";
const app = express();

// ==========================================
// CORS CONFIG - FIXED
// ==========================================
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",

  "https://flyvisa.up.railway.app", // Thêm dòng này để cho phép Frontend gọi API
  process.env.FRONTEND_URL
].filter(Boolean) as string[];

const corsOptions = {
  origin: allowedOrigins,
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// KHÔNG DÙNG app.options("*") - Đây là nguyên nhân gây lỗi
// Thay vào đó, Express sẽ tự xử lý OPTIONS thông qua cors middleware

// ==========================================
// BODY PARSER
// ==========================================
app.use(express.json({ limit: "500mb" }));
app.use(express.urlencoded({ extended: true, limit: "500mb" }));

// ==========================================
// SESSION CONFIG
// ==========================================
app.use(
  session({
    secret: "flyvisa-secret-key-2026",
    resave: false,
    saveUninitialized: false,
    cookie: {
  secure: process.env.NODE_ENV === "production", // true trên Render (HTTPS)
  httpOnly: true,
  maxAge: 24 * 60 * 60 * 1000,
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
},
  })
);

// ==========================================
// ROUTES
// ==========================================
app.use("/api/auth", authRoutes);
app.use("/api/board", boardRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/activities", activityRoutes);
app.use("/api/hr", hrRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));
app.use("/api/docs", docsRoutes);
app.use("/api/processed-docs", processedDocsRoutes);
app.use("/api/kpi", kpiRoutes);
// ==========================================
// DEFAULT ROUTE
// ==========================================
app.get("/", (req, res) => {
  res.json({
    message: "🚀 Fly Visa API Server is running!",
    status: "online",
    time: new Date().toISOString(),
    endpoints: {
      auth: {
        login: "POST /api/auth/login",
        logout: "POST /api/auth/logout",
        me: "GET /api/auth/me"
      },
      board: "GET /api/board",
      tasks: "POST, PUT, DELETE /api/tasks/:id",
      hr: "GET /api/hr/employees",
      notifications: "POST /api/notifications/send"
    }
  });
});

export default app;