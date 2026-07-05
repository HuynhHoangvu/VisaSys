/**
 * Centralized API configuration
 * - Uses localhost for development mode
 * - Uses VITE_API_URL env var for production mode (set in front-end/.env)
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

// VITE_API_URL takes precedence; falls back to localhost for local dev without env var
const rawUrl = import.meta.env.VITE_API_URL || "http://localhost:3001";

export const API_URL = normalizeApiUrl(rawUrl);
export const API_BASE_URL = `${API_URL}/api`;
export const SOCKET_URL = API_URL;

/**
 * Builds a clean, absolute or relative API URL by ensuring there is exactly one "/api" segment.
 * e.g., getApiUrl("hr/employees") -> "https://backend.com/api/hr/employees"
 */
export function getApiUrl(path: string): string {
  let host = API_URL.trim().replace(/\/+$/, "");
  while (host.toLowerCase().endsWith("/api")) {
    host = host.slice(0, -4).replace(/\/+$/, "");
  }
  
  let relativePath = path.trim().replace(/^\/+/, "");
  if (!relativePath.toLowerCase().startsWith("api/")) {
    relativePath = `api/${relativePath}`;
  }
  
  return host ? `${host}/${relativePath}` : `/${relativePath}`;
}
