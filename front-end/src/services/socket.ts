import { io } from "socket.io-client";

/** Chuẩn hóa URL API → origin Socket.IO (bỏ slash cuối và suffix /api). */
function normalizeSocketUrl(raw: string): string {
  let u = String(raw ?? "").trim().replace(/\/+$/, "");
  u = u.replace(/\/api\/?$/i, "");
  return u || "http://localhost:3001";
}

const SOCKET_URL = normalizeSocketUrl(
  import.meta.env.VITE_API_URL || "http://localhost:3001",
);

const socket = io(SOCKET_URL, {
  withCredentials: true,
  transports: ["polling", "websocket"],
  reconnectionAttempts: 12,
  reconnectionDelay: 1500,
  reconnectionDelayMax: 15000,
});

socket.on("connect_error", (err) => {
  console.warn(
    "[socket] Chưa kết nối được backend (tự thử lại):",
    err?.message ?? String(err),
  );
});

export default socket;
