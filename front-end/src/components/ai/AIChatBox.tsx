import React, { useState, useRef, useEffect, useCallback } from "react";
import { PaperPlaneTilt, X, Robot } from "@phosphor-icons/react";
import { API_URL } from "../../constants/config";

interface Message { role: "user" | "ai"; text: string; loading?: boolean; thinking?: string; done?: boolean }

function parseBold(line: string): React.ReactNode[] {
  const parts = line.split(/\*\*([^*]+)\*\*/g);
  return parts.map((p, j) =>
    j % 2 === 1 ? <strong key={j}>{p}</strong> : p.replace(/\*\*/g, "")
  );
}

function renderMarkdown(text: string): React.ReactNode {
  const lines = text.split("\n");
  return (
    <>
      {lines.map((line, i) => {
        if (line === "") return <div key={i} className="h-2" />;
        const isBullet = /^\s*[-*]\s+/.test(line);
        const content = isBullet ? line.replace(/^\s*[-*]\s+/, "") : line;
        return isBullet ? (
          <div key={i} className="flex gap-1.5 items-start">
            <span className="mt-1.5 shrink-0 w-1 h-1 rounded-full bg-slate-400 inline-block" />
            <span>{parseBold(content)}</span>
          </div>
        ) : (
          <div key={i}>{parseBold(line)}</div>
        );
      })}
    </>
  );
}

const QUICK_QUESTIONS = [
  "Hôm nay ai chưa điểm danh?",
  "Visa 482 là gì?",
  "Doanh thu tháng này bao nhiêu?",
  "Nhân viên nào bán tốt nhất?",
  "Danh sách khách hàng tiềm năng",
  "Tổng quan pipeline hiện tại",
];

const AIChatBox: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [messages, setMessages] = useState<Message[]>([
    { role: "ai", text: "Xin chào! Tôi là trợ lý AI của Fly Visa.\n\nTôi có thể giúp bạn phân tích dữ liệu kinh doanh thời gian thực. Hãy hỏi tôi bất cứ điều gì về doanh thu, khách hàng, hay hiệu suất nhân viên!", done: true },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showQuickQuestions, setShowQuickQuestions] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const getToken = () => {
    try { return JSON.parse(localStorage.getItem("flyvisa_user") ?? "{}")?.token ?? ""; }
    catch { return ""; }
  };

  const sendMessage = useCallback(async (text?: string) => {
    const msgText = (text ?? input).trim();
    if (!msgText || isLoading) return;
    setInput("");
    setShowQuickQuestions(false);
    setMessages((prev) => [...prev, { role: "user", text: msgText }]);
    setMessages((prev) => [...prev, { role: "ai", text: "", loading: true }]);
    setIsLoading(true);

    const token = getToken();
    let accumulated = "";
    try {
      const res = await fetch(`${API_URL}/api/ai/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        credentials: "include",
        body: JSON.stringify({ message: msgText }),
      });
      if (!res.ok || !res.body) throw new Error("Lỗi kết nối");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const lines = decoder.decode(value).split("\n");
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") {
            setMessages((prev) => {
              const updated = [...prev];
              updated[updated.length - 1] = { ...updated[updated.length - 1], done: true };
              return updated;
            });
            break;
          }
          try {
            const parsed = JSON.parse(data);
            if (parsed.thinking) {
              // Hiển thị thinking indicator (AI đang gọi tool)
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: "ai", text: "", loading: true, thinking: parsed.thinking };
                return updated;
              });
            } else if (parsed.text) {
              accumulated += parsed.text;
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: "ai", text: accumulated, loading: false, thinking: undefined };
                return updated;
              });
            }
          } catch { /* skip */ }
        }
      }
    } catch {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: "ai", text: "Xin lỗi, có lỗi xảy ra. Vui lòng thử lại.", loading: false };
        return updated;
      });
    } finally { setIsLoading(false); }
  }, [input, isLoading]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  return (
    <div className="fixed bottom-20 right-4 z-50 w-95 max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden"
      style={{ height: "520px" }}>

      {/* Header — solid dark */}
      <div className="flex items-center gap-3 px-4 py-3 bg-slate-900 shrink-0">
        <div className="relative">
          <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
            <Robot size={18} color="white" weight="duotone" />
          </div>
          <span className="absolute bottom-0 right-0 w-2 h-2 bg-emerald-400 rounded-full border-2 border-slate-900" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-white">AI Phân tích CRM</p>
          <p className="text-2xs text-white/50">Rule-based AI · Không cần API · Dữ liệu realtime</p>
        </div>
        <button onClick={onClose} className="text-white/40 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10">
          <X size={16} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            {msg.role === "ai" && (
              <div className="w-7 h-7 rounded-full bg-slate-900 text-white text-2xs flex items-center justify-center mr-2 mt-0.5 shrink-0">
                AI
              </div>
            )}
            <div className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed
              ${msg.role === "user"
                ? "bg-slate-900 text-white rounded-br-sm"
                : "bg-white text-slate-700 shadow-sm border border-slate-200 rounded-bl-sm"
              }`}>
              {msg.loading ? (
                msg.thinking ? (
                  <span className="flex items-center gap-2 py-0.5 text-xs text-slate-500">
                    <span className="flex gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                    </span>
                    {msg.thinking}
                  </span>
                ) : (
                  <span className="flex gap-1.5 items-center py-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </span>
                )
              ) : msg.role === "ai" ? renderMarkdown(msg.text) : msg.text}
            </div>
          </div>
        ))}

        {showQuickQuestions && messages.length <= 1 && (
          <div className="space-y-2 pt-1">
            <p className="text-2xs text-slate-400 text-center font-medium uppercase tracking-widest">Câu hỏi gợi ý</p>
            <div className="grid grid-cols-2 gap-1.5">
              {QUICK_QUESTIONS.map((q) => (
                <button key={q} onClick={() => sendMessage(q)}
                  className="text-left text-xs text-slate-600 bg-white hover:bg-slate-50 border border-slate-200 hover:border-orange-300 rounded-xl px-3 py-2 transition-colors leading-tight">
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-3 bg-white border-t border-slate-100 shrink-0">
        <div className="flex items-end gap-2 bg-slate-50 rounded-xl border border-slate-200 focus-within:border-slate-400 focus-within:bg-white transition-colors px-3 py-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Hỏi về doanh thu, khách hàng, nhân viên..."
            rows={1}
            className="flex-1 bg-transparent text-sm resize-none outline-none text-slate-800 placeholder-slate-400 max-h-24"
            style={{ minHeight: "24px" }}
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || isLoading}
            className="w-8 h-8 rounded-lg bg-slate-900 hover:bg-black text-white flex items-center justify-center disabled:opacity-40 transition-all shrink-0"
          >
            <PaperPlaneTilt size={15} weight="fill" />
          </button>
        </div>
        <p className="text-2xs text-slate-400 text-center mt-1.5">Enter để gửi · Shift+Enter xuống dòng</p>
      </div>
    </div>
  );
};

export default AIChatBox;
