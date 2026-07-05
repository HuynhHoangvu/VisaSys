import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  ChatTeardropDots, X, PaperPlaneTilt, ArrowLeft,
  MagnifyingGlass, PencilSimpleLine, Robot, Sparkle,
} from "@phosphor-icons/react";
import api from "../../services/api";
import { connectChatSocket, getChatSocket, type ChatMessage } from "../../services/chatSocket";
import { API_URL } from "../../constants/config";
import type { AuthUser } from "../../types";

interface ChatUser {
  id: string;
  name: string;
  role: string;
  department?: { name: string } | null;
}

interface Conversation {
  room: { id: string };
  other: ChatUser;
  lastMsg: { content: string; senderId: string; createdAt: string } | null;
  unread: number;
}

type View = "conversations" | "new" | "dm" | "ai";

// ── Helpers ──────────────────────────────────────────────────────────────────
const formatTime = (iso: string) => {
  const d = new Date(iso);
  const diffH = (Date.now() - d.getTime()) / 3600000;
  return diffH < 24
    ? d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
};

// ── Avatar ───────────────────────────────────────────────────────────────────
const Avatar: React.FC<{ name: string; size?: number; online?: boolean }> = ({ name, size = 36, online }) => {
  const colors = ["bg-blue-500","bg-violet-500","bg-emerald-500","bg-orange-500","bg-pink-500","bg-teal-500"];
  const color = colors[name.charCodeAt(0) % colors.length];
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <div className={`w-full h-full rounded-full ${color} flex items-center justify-center`}>
        <span className="text-white font-bold" style={{ fontSize: size * 0.4 }}>
          {name.charAt(0).toUpperCase()}
        </span>
      </div>
      {online !== undefined && (
        <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white ${online ? "bg-emerald-400" : "bg-slate-300"}`} />
      )}
    </div>
  );
};

// ── AI Chat ──────────────────────────────────────────────────────────────────
const QUICK_QUESTIONS = [
  "Tháng này doanh thu bao nhiêu?",
  "Khách nào đang hot nhất?",
  "Nhân viên nào bán tốt nhất?",
  "So sánh tháng này vs tháng trước",
  "Loại visa phổ biến nhất?",
  "Khách đang trong pipeline?",
];

interface AIMessage { role: "user" | "ai"; text: string; loading?: boolean }
interface HistoryItem { role: "user" | "model"; parts: string }

const AIChat: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [messages, setMessages] = useState<AIMessage[]>([
    { role: "ai", text: "Xin chào! Tôi là trợ lý AI của Fly Visa 👋\n\nTôi nắm được toàn bộ dữ liệu doanh thu, khách hàng, hồ sơ và hiệu suất nhân viên theo thời gian thực. Hãy hỏi tôi bất cứ điều gì!" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showQuick, setShowQuick] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<HistoryItem[]>([]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const getToken = () => {
    try { return JSON.parse(localStorage.getItem("flyvisa_user") ?? "{}")?.token ?? ""; } catch { return ""; }
  };

  const sendMessage = useCallback(async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;
    setInput("");
    setShowQuick(false);
    setMessages((prev) => [...prev, { role: "user", text: msg }, { role: "ai", text: "", loading: true }]);
    setLoading(true);

    let accumulated = "";
    try {
      const res = await fetch(`${API_URL}/api/ai/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        credentials: "include",
        body: JSON.stringify({ message: msg, history: historyRef.current }),
      });
      if (!res.ok || !res.body) throw new Error();
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const line of decoder.decode(value).split("\n")) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") break;
          try {
            const p = JSON.parse(data);
            if (p.text) {
              accumulated += p.text;
              setMessages((prev) => {
                const u = [...prev];
                u[u.length - 1] = { role: "ai", text: accumulated, loading: false };
                return u;
              });
            }
          } catch { /* skip */ }
        }
      }
      historyRef.current = [...historyRef.current,
        { role: "user" as const, parts: msg }, { role: "model" as const, parts: accumulated }].slice(-10);
    } catch {
      setMessages((prev) => {
        const u = [...prev];
        u[u.length - 1] = { role: "ai", text: "Xin lỗi, có lỗi xảy ra. Vui lòng thử lại.", loading: false };
        return u;
      });
    } finally { setLoading(false); }
  }, [input, loading]);

  return (
    <>
      {/* Sub-header */}
      <div className="bg-white border-b border-gray-100 px-3 py-2.5 flex items-center gap-2.5 shrink-0">
        <button onClick={onBack} className="text-slate-400 hover:text-slate-700 p-1 -ml-1 rounded-lg hover:bg-slate-100 transition-colors">
          <ArrowLeft size={16} weight="bold" />
        </button>
        <div className="w-8 h-8 rounded-full bg-slate-900 flex items-center justify-center shrink-0">
          <Robot size={16} color="white" weight="duotone" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-800">Trợ lý AI</p>
          <p className="text-[10px] text-emerald-500 font-medium flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
            Dữ liệu realtime · Gemini
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 bg-slate-50">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} items-end gap-2`}>
            {msg.role === "ai" && (
              <div className="w-6 h-6 rounded-full bg-slate-900 flex items-center justify-center shrink-0 mb-0.5">
                <Robot size={13} color="white" weight="duotone" />
              </div>
            )}
            <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
              msg.role === "user"
                ? "bg-blue-600 text-white rounded-br-sm"
                : "bg-white text-slate-700 border border-slate-200 shadow-sm rounded-bl-sm"
            }`}>
              {msg.loading ? (
                <span className="flex gap-1 items-center py-0.5">
                  {[0,150,300].map((d) => (
                    <span key={d} className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: `${d}ms` }} />
                  ))}
                </span>
              ) : msg.text}
            </div>
          </div>
        ))}

        {showQuick && messages.length <= 1 && (
          <div className="pt-1 space-y-2">
            <p className="text-[10px] text-slate-400 text-center font-semibold uppercase tracking-widest">Gợi ý câu hỏi</p>
            <div className="grid grid-cols-2 gap-1.5">
              {QUICK_QUESTIONS.map((q) => (
                <button key={q} onClick={() => sendMessage(q)}
                  className="text-left text-xs text-slate-600 bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-300 rounded-xl px-2.5 py-2 transition-colors leading-tight">
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-3 py-3 border-t border-gray-100 bg-white shrink-0">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            placeholder="Hỏi về doanh thu, khách hàng..."
            className="flex-1 bg-gray-100 rounded-full px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white transition-all"
            maxLength={500}
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || loading}
            className="w-9 h-9 bg-slate-900 hover:bg-black disabled:opacity-40 rounded-full flex items-center justify-center shrink-0 transition-colors"
          >
            <PaperPlaneTilt size={16} color="white" weight="fill" />
          </button>
        </div>
      </div>
    </>
  );
};

// ── Conversation List ────────────────────────────────────────────────────────
const ConversationList: React.FC<{
  currentUser: AuthUser;
  onlineIds: string[];
  onSelect: (conv: Conversation) => void;
  onNew: () => void;
  onAI: () => void;
  refreshKey: number;
}> = ({ currentUser, onlineIds, onSelect, onAI, refreshKey }) => {
  const [convs, setConvs] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get<Conversation[]>("/api/chat/conversations")
      .then((r) => setConvs(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [refreshKey]);

  return (
    <div className="flex-1 overflow-y-auto">
      {/* AI pinned entry */}
      <button
        onClick={onAI}
        className="w-full flex items-center gap-3 px-3 py-3 hover:bg-slate-50 transition-colors text-left border-b-2 border-slate-100"
      >
        <div className="relative shrink-0">
          <div className="w-10 h-10 rounded-full bg-slate-900 flex items-center justify-center">
            <Robot size={20} color="white" weight="duotone" />
          </div>
          <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-400 border-2 border-white flex items-center justify-center">
            <Sparkle size={6} color="white" weight="fill" />
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-800">Trợ lý AI</p>
            <span className="text-[10px] bg-emerald-100 text-emerald-600 font-semibold px-1.5 py-0.5 rounded-full">AI</span>
          </div>
          <p className="text-xs text-slate-400 truncate">Phân tích doanh thu, khách hàng, hồ sơ...</p>
        </div>
      </button>

      {loading && (
        <div className="flex justify-center py-8">
          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!loading && convs.length === 0 && (
        <div className="flex flex-col items-center justify-center py-10 gap-2 text-slate-400 px-6 text-center">
          <ChatTeardropDots size={36} weight="light" />
          <p className="text-sm font-medium">Chưa có tin nhắn nào</p>
          <p className="text-xs">Nhấn nút <span className="font-semibold text-blue-500">✏️</span> để bắt đầu nhắn tin</p>
        </div>
      )}

      {convs.map((conv) => {
        const online = onlineIds.includes(conv.other.id);
        const isMyLast = conv.lastMsg?.senderId === currentUser.id;
        return (
          <button
            key={conv.room.id}
            onClick={() => onSelect(conv)}
            className="w-full flex items-center gap-3 px-3 py-3 hover:bg-slate-50 transition-colors text-left border-b border-slate-50"
          >
            <Avatar name={conv.other.name} size={42} online={online} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between mb-0.5">
                <p className="text-sm font-semibold text-slate-800 truncate">{conv.other.name}</p>
                {conv.lastMsg && (
                  <span className="text-[10px] text-slate-400 shrink-0 ml-2">{formatTime(conv.lastMsg.createdAt)}</span>
                )}
              </div>
              <p className="text-xs text-slate-500 truncate">
                {conv.lastMsg ? `${isMyLast ? "Bạn: " : ""}${conv.lastMsg.content}` : <em>Bắt đầu trò chuyện</em>}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
};

// ── New Chat ─────────────────────────────────────────────────────────────────
const NewChat: React.FC<{
  onlineIds: string[];
  onSelect: (user: ChatUser) => void;
  onBack: () => void;
}> = ({ onlineIds, onSelect, onBack }) => {
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    api.get<ChatUser[]>("/api/chat/users").then((r) => setUsers(r.data)).catch(console.error);
  }, []);

  const sorted = [...users]
    .filter((u) => u.name.toLowerCase().includes(search.toLowerCase()) || u.role.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => (onlineIds.includes(b.id) ? 1 : 0) - (onlineIds.includes(a.id) ? 1 : 0) || a.name.localeCompare(b.name, "vi"));

  return (
    <>
      <div className="px-3 py-2.5 border-b border-gray-100 shrink-0 flex items-center gap-2">
        <button onClick={onBack} className="text-slate-400 hover:text-slate-700 p-1 -ml-1 rounded-lg hover:bg-slate-100 transition-colors">
          <ArrowLeft size={16} weight="bold" />
        </button>
        <div className="relative flex-1">
          <MagnifyingGlass size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            autoFocus
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm người để nhắn..."
            className="w-full bg-gray-100 rounded-full pl-8 pr-4 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white transition-all"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {sorted.map((user) => (
          <button key={user.id} onClick={() => onSelect(user)}
            className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 transition-colors text-left">
            <Avatar name={user.name} size={38} online={onlineIds.includes(user.id)} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-800 truncate">{user.name}</p>
              <p className="text-xs text-slate-400 truncate">{user.department?.name ?? user.role}</p>
            </div>
            {onlineIds.includes(user.id) && <span className="text-[10px] text-emerald-500 font-medium shrink-0">Online</span>}
          </button>
        ))}
      </div>
    </>
  );
};

// ── DM Chat ──────────────────────────────────────────────────────────────────
const DMChat: React.FC<{
  currentUser: AuthUser;
  target: ChatUser;
  onBack: () => void;
  onMessageSent: () => void;
}> = ({ currentUser, target, onBack, onMessageSent }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [typingName, setTypingName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.get<{ room: { id: string } }>(`/api/chat/dm/${target.id}`)
      .then(async (res) => {
        if (cancelled) return;
        const rid = res.data.room.id;
        setRoomId(rid);
        const msgRes = await api.get<ChatMessage[]>(`/api/chat/rooms/${rid}/messages`);
        if (!cancelled) { setMessages(msgRes.data); setLoading(false); }
      }).catch(() => setLoading(false));
    return () => { cancelled = true; };
  }, [target.id]);

  useEffect(() => {
    if (!roomId) return;
    const sock = getChatSocket();
    if (!sock) return;
    const join = () => sock.emit("chat:join", roomId);
    sock.connected ? join() : sock.once("connect", join);
    const onMsg = (msg: ChatMessage) => {
      if (msg.roomId !== roomId) return;
      setMessages((prev) => prev.find((m) => m.id === msg.id) ? prev : [...prev, msg]);
    };
    const onTyping = (d: { userId: string; name: string; isTyping: boolean }) => {
      if (d.userId === currentUser.id) return;
      setTypingName(d.isTyping ? d.name : null);
    };
    sock.on("chat:message:new", onMsg);
    sock.on("chat:typing:update", onTyping);
    return () => { sock.off("chat:message:new", onMsg); sock.off("chat:typing:update", onTyping); };
  }, [roomId, currentUser.id]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const sendMessage = () => {
    const content = input.trim();
    if (!content || !roomId) return;
    const sock = getChatSocket();
    sock?.emit("chat:message", { roomId, content });
    if (isTypingRef.current) { sock?.emit("chat:typing", { roomId, isTyping: false }); isTypingRef.current = false; }
    setInput("");
    onMessageSent();
  };

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
    const sock = getChatSocket();
    if (!sock || !roomId) return;
    if (!isTypingRef.current) { isTypingRef.current = true; sock.emit("chat:typing", { roomId, isTyping: true }); }
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      isTypingRef.current = false;
      sock.emit("chat:typing", { roomId, isTyping: false });
    }, 2000);
  };

  return (
    <>
      <div className="bg-white border-b border-gray-100 px-3 py-2.5 flex items-center gap-2.5 shrink-0">
        <button onClick={onBack} className="text-slate-400 hover:text-slate-700 p-1 -ml-1 rounded-lg hover:bg-slate-100 transition-colors">
          <ArrowLeft size={16} weight="bold" />
        </button>
        <Avatar name={target.name} size={32} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-800 truncate">{target.name}</p>
          <p className="text-xs text-slate-400 truncate">{target.role}</p>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1 bg-gray-50">
        {loading && <div className="flex justify-center py-6"><div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>}
        {!loading && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-gray-400">
            <ChatTeardropDots size={32} weight="light" />
            <p className="text-sm">Bắt đầu trò chuyện với {target.name}</p>
          </div>
        )}
        {messages.map((msg, i) => {
          const isMe = msg.senderId === currentUser.id;
          const showAvatar = !isMe && messages[i - 1]?.senderId !== msg.senderId;
          return (
            <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"} items-end gap-1.5`}>
              {!isMe && <div className="w-6 shrink-0">{showAvatar && <Avatar name={msg.senderName} size={24} />}</div>}
              <div className={`max-w-[72%] flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                <div className={`px-3 py-2 rounded-2xl text-sm break-words ${isMe ? "bg-blue-600 text-white rounded-br-sm" : "bg-white text-slate-800 border border-gray-200 rounded-bl-sm shadow-sm"}`}>
                  {msg.content}
                </div>
                <span className="text-[10px] text-gray-400 mt-0.5 px-1">{formatTime(msg.createdAt)}</span>
              </div>
            </div>
          );
        })}
        {typingName && (
          <div className="flex justify-start items-end gap-1.5">
            <div className="w-6 shrink-0" />
            <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-sm px-3 py-2 shadow-sm flex items-center gap-1">
              <span className="text-xs text-gray-400">{typingName} đang nhập</span>
              {[0,1,2].map((i) => <span key={i} className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: `${i*0.15}s` }} />)}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div className="px-3 py-3 border-t border-gray-100 bg-white shrink-0">
        <div className="flex items-center gap-2">
          <input type="text" value={input} onChange={handleInput}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            placeholder={`Nhắn cho ${target.name}...`}
            className="flex-1 bg-gray-100 rounded-full px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white transition-all"
            maxLength={1000} />
          <button onClick={sendMessage} disabled={!input.trim()}
            className="w-9 h-9 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 rounded-full flex items-center justify-center shrink-0 transition-colors">
            <PaperPlaneTilt size={16} color="white" weight="fill" />
          </button>
        </div>
      </div>
    </>
  );
};

// ── Main ChatBubble ──────────────────────────────────────────────────────────
const ChatBubble: React.FC<{ currentUser: AuthUser | null }> = ({ currentUser }) => {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("conversations");
  const [selectedUser, setSelectedUser] = useState<ChatUser | null>(null);
  const [onlineIds, setOnlineIds] = useState<string[]>([]);
  const [unread, setUnread] = useState(0);
  const [convRefresh, setConvRefresh] = useState(0);

  useEffect(() => {
    if (!currentUser) return;
    const stored = localStorage.getItem("flyvisa_user");
    const user: AuthUser = stored ? JSON.parse(stored) : currentUser;
    const sock = connectChatSocket(user.id, user.name, user.department ?? undefined);
    sock.on("chat:online", (users: { userId: string }[]) => setOnlineIds(users.map((u) => u.userId)));
    sock.on("chat:message:new", () => {
      if (!open) setUnread((c) => c + 1);
      setConvRefresh((c) => c + 1);
    });
    return () => { sock.off("chat:online"); sock.off("chat:message:new"); };
  }, [currentUser, open]);

  useEffect(() => { if (open) setUnread(0); }, [open]);

  const titles: Record<View, string> = {
    conversations: "Tin nhắn",
    new: "Nhắn tin mới",
    dm: selectedUser?.name ?? "Chat",
    ai: "Trợ lý AI",
  };

  const handleClose = () => { setOpen(false); setView("conversations"); setSelectedUser(null); };

  if (!currentUser) return null;

  return (
    <>
      {open && (
        <div className="fixed bottom-20 right-4 z-50 w-80 sm:w-[340px] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-gray-200" style={{ height: 500 }}>
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <ChatTeardropDots size={18} color="white" weight="fill" className="shrink-0" />
              <span className="text-white font-semibold text-sm truncate">{titles[view]}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {view === "conversations" && (
                <button onClick={() => setView("new")} className="text-blue-200 hover:text-white transition-colors" title="Nhắn tin mới">
                  <PencilSimpleLine size={17} weight="bold" />
                </button>
              )}
              <button onClick={handleClose} className="text-blue-200 hover:text-white transition-colors">
                <X size={18} weight="bold" />
              </button>
            </div>
          </div>

          {view === "conversations" && (
            <ConversationList
              currentUser={currentUser}
              onlineIds={onlineIds}
              onSelect={(conv) => { setSelectedUser(conv.other); setView("dm"); }}
              onNew={() => setView("new")}
              onAI={() => setView("ai")}
              refreshKey={convRefresh}
            />
          )}
          {view === "new" && (
            <NewChat
              onlineIds={onlineIds}
              onSelect={(user) => { setSelectedUser(user); setView("dm"); }}
              onBack={() => setView("conversations")}
            />
          )}
          {view === "dm" && selectedUser && (
            <DMChat
              currentUser={currentUser}
              target={selectedUser}
              onBack={() => { setView("conversations"); setSelectedUser(null); setConvRefresh((c) => c + 1); }}
              onMessageSent={() => setConvRefresh((c) => c + 1)}
            />
          )}
          {view === "ai" && (
            <AIChat onBack={() => setView("conversations")} />
          )}
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        className={`fixed bottom-4 right-4 z-50 rounded-2xl shadow-xl flex items-center justify-center transition-all duration-200 ${
          open ? "bg-blue-700 hover:bg-blue-800" : "bg-blue-600 hover:bg-blue-700 hover:scale-105"
        }`}
        style={{ width: 52, height: 52 }}
        title="Tin nhắn"
      >
        {open
          ? <X size={20} color="white" weight="bold" />
          : <>
              <ChatTeardropDots size={24} color="white" weight="fill" />
              {unread > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center leading-none">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </>
        }
      </button>
    </>
  );
};

export default ChatBubble;
