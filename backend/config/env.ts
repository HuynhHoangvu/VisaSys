import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

export const NODE_ENV = process.env.NODE_ENV ?? "development";
export const isProduction = NODE_ENV === "production";

/**
 * Cross-site cookie chỉ cần khi FE và API khác domain/origin.
 * Khi dùng cùng Nginx (same domain), đặt SESSION_CROSS_SITE=false trong .env.
 * Mặc định true khi NODE_ENV=production để an toàn trên HTTPS.
 */
export const sessionCookieCrossSite =
  process.env.SESSION_CROSS_SITE === "1" ||
  process.env.SESSION_CROSS_SITE === "true" ||
  (isProduction && process.env.SESSION_CROSS_SITE !== "false");
export const PORT = process.env.PORT ?? "3001";
export const FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:5173";
export const SESSION_SECRET = process.env.SESSION_SECRET ?? "flyvisa-secret-key-2026";
/** Ký JWT refresh token — nên set JWT_REFRESH_SECRET riêng trên production. */
export const JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET ?? `${SESSION_SECRET}:flyvisa-jwt-refresh`;
export const DATABASE_URL = process.env.DATABASE_URL ?? "";

const DEFAULT_CORS_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:5174",
] as const;

/** Browser Origin has no trailing slash; env values often do — normalize so CORS matches. */
function normalizeOrigin(origin: string): string {
  const o = origin.trim();
  return o.endsWith("/") ? o.slice(0, -1) : o;
}

/** Merged default origins, FRONTEND_URL, and comma-separated CORS_ORIGINS (deduped). */
export function getCorsOrigins(): string[] {
  const fromEnv = (process.env.CORS_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const merged = [...DEFAULT_CORS_ORIGINS, FRONTEND_URL, ...fromEnv];
  return [...new Set(merged.filter(Boolean).map(normalizeOrigin))];
}

export function assertDatabaseUrl(): void {
  if (!DATABASE_URL) {
    throw new Error("DATABASE_URL is not defined in environment variables.");
  }
}
