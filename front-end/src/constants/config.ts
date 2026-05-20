/**
 * Centralized API configuration
 * - Uses localhost for development mode
 * - Uses VITE_API_URL env var (Railway) for production mode
 */

// Always use localhost for local development
const BASE_URL = import.meta.env.MODE === "production"
  ? import.meta.env.VITE_API_URL || "http://localhost:3001"
  : "http://localhost:3001";

export const API_BASE_URL = `${BASE_URL}/api`;
export const API_URL = BASE_URL;
export const SOCKET_URL = BASE_URL;
