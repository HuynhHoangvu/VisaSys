import { io } from "socket.io-client";
import { SOCKET_URL } from "../constants/config";

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
