import { io, Socket } from "socket.io-client";
import { SOCKET_URL } from "../constants/config";

export interface ChatMessage {
  id: string;
  content: string;
  senderId: string;
  senderName: string;
  roomId: string;
  createdAt: string;
}

export interface OnlineUser {
  userId: string;
  name: string;
}

export interface TypingUpdate {
  userId: string;
  name: string;
  isTyping: boolean;
}

let socket: Socket | null = null;

export function connectChatSocket(userId: string, userName: string, departmentId?: string): Socket {
  if (socket?.connected) return socket;

  socket = io(SOCKET_URL, {
    auth: { userId, userName, departmentId },
    withCredentials: true,
    transports: ["websocket", "polling"],
  });

  return socket;
}

export function getChatSocket(): Socket | null {
  return socket;
}

export function disconnectChatSocket() {
  socket?.disconnect();
  socket = null;
}
