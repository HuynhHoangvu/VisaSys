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

export function assertDatabaseUrl(): void {
  if (!DATABASE_URL) {
    throw new Error("DATABASE_URL is not defined in environment variables.");
  }
}
