/**
 * Centralized API configuration
 * - Uses localhost for development mode
 * - Uses VITE_API_URL env var (Railway) for production mode
 */

// Helper to normalize the API URL by trimming trailing slashes and stripping /api suffix
function normalizeApiUrl(raw: string): string {
  let u = String(raw ?? "").trim();
  // Keep removing trailing slashes and /api suffix
  while (true) {
    u = u.replace(/\/+$/, "");
    if (u.toLowerCase().endsWith("/api")) {
      u = u.slice(0, -4);
    } else {
      break;
    }
  }
  return u || "http://localhost:3001";
}

// Always use localhost for local development
const rawUrl = import.meta.env.MODE === "production"
  ? import.meta.env.VITE_API_URL || "http://localhost:3001"
  : "http://localhost:3001";

export const API_URL = normalizeApiUrl(rawUrl);
export const API_BASE_URL = `${API_URL}/api`;
export const SOCKET_URL = API_URL;
