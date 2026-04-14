import express from "express";
import cors from "cors";
import session from "express-session";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import path from "path";
import boardRoutes from "./routes/board.routes.js";
import activityRoutes from "./routes/activity.routes.js";
import hrRoutes from "./routes/hr.routes.js";
import notificationRoutes from "./routes/notification.routes.js";
import authRoutes from "./routes/auth.routes.js";
import taskRoutes from "./routes/task.routes.js";
import docsRoutes from "./routes/docs.routes.js";
import processedDocsRoutes from "./routes/processedDocs.routes.js";
import kpiRoutes from "./routes/kpi.routes.js";
import { errorHandler } from "./middlewares/errorHandler.js";
import { FRONTEND_URL, SESSION_SECRET, isProduction } from "../config/env.js";

const app = express();

app.set("trust proxy", 1);

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Quá nhiều request, vui lòng thử lại sau." }
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: "Quá nhiều lần đăng nhập thất bại, thử lại sau 15 phút." }
});

app.use("/api/", apiLimiter);
app.use("/api/auth/login", loginLimiter);

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "https://flyvisa.up.railway.app",
  FRONTEND_URL
].filter(Boolean) as string[];

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  optionsSuccessStatus: 200
}));

app.use(express.json({ limit: "1000mb" }));
app.use(express.urlencoded({ extended: true, limit: "1000mb" }));

app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: isProduction,
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000,
    sameSite: isProduction ? "none" : "lax",
  },
}));

app.use("/api/auth",           authRoutes);
app.use("/api/board",          boardRoutes);
app.use("/api/tasks",          taskRoutes);
app.use("/api/activities",     activityRoutes);
app.use("/api/hr",             hrRoutes);
app.use("/api/notifications",  notificationRoutes);
app.use("/api/docs",           docsRoutes);
app.use("/api/processed-docs", processedDocsRoutes);
app.use("/api/kpi",            kpiRoutes);
app.use("/uploads",            express.static(path.join(process.cwd(), "uploads")));

app.get("/", (_req, res) => {
  res.json({
    message: "🚀 Fly Visa API Server is running!",
    status: "online",
    time: new Date().toISOString(),
  });
});

// Must be registered last — catches errors forwarded by asyncHandler
app.use(errorHandler);

export default app;
