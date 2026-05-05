import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

export const NODE_ENV = process.env.NODE_ENV ?? "development";
export const isProduction = NODE_ENV === "production";
export const PORT = process.env.PORT ?? "3001";
export const FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:5173";
export const SESSION_SECRET = process.env.SESSION_SECRET ?? "flyvisa-secret-key-2026";
export const DATABASE_URL = process.env.DATABASE_URL ?? "";
export const GCS_BUCKET_NAME = process.env.GCS_BUCKET_NAME ?? "flyvisa-documents";
export const GCS_PROJECT_ID = process.env.GCS_PROJECT_ID ?? "";
export const GCS_CLIENT_EMAIL = process.env.GCS_CLIENT_EMAIL ?? "";
export const GCS_PRIVATE_KEY = process.env.GCS_PRIVATE_KEY ?? "";
export const GOOGLE_KEYFILE_PATH = path.join(process.cwd(), "config", "google-key.json");

const DEFAULT_CORS_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:5174",
  "https://flyvisa.up.railway.app",
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
