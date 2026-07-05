import React, { useState, useEffect, useCallback } from "react";
import { Sparkle, ArrowsClockwise } from "@phosphor-icons/react";
import api from "../../services/api";

interface Insight {
  type: "warning" | "opportunity" | "info" | "success";
  title: string;
  body: string;
  action: string;
}

const TYPE_CONFIG = {
  warning: {
    accent: "border-l-amber-400",
    badge: "bg-amber-50 text-amber-700",
    icon: "⚠️",
    label: "Cần chú ý",
  },
  opportunity: {
    accent: "border-l-emerald-400",
    badge: "bg-emerald-50 text-emerald-700",
    icon: "🚀",
    label: "Cơ hội",
  },
  success: {
    accent: "border-l-blue-400",
    badge: "bg-blue-50 text-blue-700",
    icon: "✅",
    label: "Điểm mạnh",
  },
  info: {
    accent: "border-l-slate-300",
    badge: "bg-slate-100 text-slate-600",
    icon: "💡",
    label: "Insight",
  },
};

const AIInsightsPanel: React.FC = () => {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchInsights = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const { data } = await api.post<Insight[]>("/api/ai/insights");
      setInsights(data);
      setLastUpdated(new Date());
    } catch {
      setError("Không thể tải phân tích AI. Vui lòng thử lại.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchInsights(); }, [fetchInsights]);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-violet-50 flex items-center justify-center">
            <Sparkle size={20} weight="duotone" className="text-violet-500" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-700">Phân tích thông minh AI</h3>
            <p className="text-2xs text-slate-400 mt-0.5">
              {lastUpdated
                ? `Cập nhật ${lastUpdated.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })} · Cache 30 phút`
                : "Powered by Gemini · Phân tích dữ liệu 3 tháng"}
            </p>
          </div>
        </div>
        <button
          onClick={fetchInsights}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs font-semibold text-violet-600 hover:text-violet-700 bg-violet-50 hover:bg-violet-100 border border-violet-100 rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ArrowsClockwise size={14} className={loading ? "animate-spin" : ""} />
          {loading ? "Đang phân tích..." : "Làm mới"}
        </button>
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="animate-pulse rounded-xl bg-slate-100 h-32" />)}
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="flex items-center gap-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl p-4">
          <span className="text-lg">⚠️</span>
          <span>{error}</span>
          <button onClick={fetchInsights} className="ml-auto underline hover:no-underline font-medium text-xs">Thử lại</button>
        </div>
      )}

      {/* Insights grid */}
      {!loading && !error && insights.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {insights.map((ins, i) => {
            const cfg = TYPE_CONFIG[ins.type] ?? TYPE_CONFIG.info;
            return (
              <div key={i} className={`bg-white rounded-xl border border-slate-200 border-l-4 ${cfg.accent} p-4 flex flex-col gap-2 hover:shadow-sm transition-shadow`}>
                <span className={`text-2xs font-bold px-2 py-0.5 rounded-md self-start ${cfg.badge}`}>
                  {cfg.icon} {cfg.label}
                </span>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-900 leading-snug mb-1">{ins.title}</p>
                  <p className="text-xs text-slate-500 leading-relaxed">{ins.body}</p>
                </div>
                {ins.action && (
                  <div className="bg-slate-50 border-t border-slate-100 -mx-4 -mb-4 px-4 py-2.5 rounded-b-xl mt-1">
                    <p className="text-xs font-semibold text-slate-600">→ {ins.action}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AIInsightsPanel;
