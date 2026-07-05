import React, { useState, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import { NavLink } from "react-router-dom";
import {
  UsersThree, CurrencyCircleDollar, ArrowsClockwise, CheckCircle,
  UsersThree as UsersIcon, ClipboardText, Clock, FolderOpen, Tag,
  Warning,
} from "@phosphor-icons/react";
import api from "../../services/api";
import type { BoardData, AuthUser } from "../../types";
import PipelineFunnelChart from "./PipelineFunnelChart";
import EmployeePerformanceChart from "./EmployeePerformanceChart";
import RevenueForecastChart from "./RevenueForecastChart";
import AIInsightsPanel from "./AIInsightsPanel";

interface DashboardProps { currentUser: AuthUser }

const CHART_COLORS = ["#f97316", "#3b82f6", "#10b981", "#8b5cf6", "#ef4444", "#14b8a6", "#f59e0b"];
const MONTHS = ["T1","T2","T3","T4","T5","T6","T7","T8","T9","T10","T11","T12"];

const parsePrice = (price: string): number => {
  if (!price) return 0;
  return parseInt(price.replace(/[^0-9]/g, "")) || 0;
};

const formatRevenueMillion = (value: number) => {
  if (value >= 1000) return `${(value / 1000).toFixed(1)}Tỷ`;
  return `${value}Tr`;
};

const formatFullRevenue = (value: number) => {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)} Tỷ`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(0)} Triệu`;
  return new Intl.NumberFormat("vi-VN").format(value) + "đ";
};

interface StatCardProps {
  title: string;
  value: string;
  sub: string;
  icon: React.ReactNode;
  iconBg: string;
  trend?: string;
  trendUp?: boolean;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, sub, icon, iconBg, trend, trendUp }) => (
  <div className="bg-white border border-slate-200 rounded-xl p-4 md:p-5 hover:shadow-sm transition-shadow flex flex-col gap-3">
    <div className="flex items-center justify-between">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}>
        {icon}
      </div>
      {trend && (
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${trendUp !== false ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500"}`}>
          {trend}
        </span>
      )}
    </div>
    <div>
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-1">{title}</p>
      <p className="text-3xl font-black text-slate-900 tracking-tight leading-tight">{value}</p>
      <p className="text-xs text-slate-500 mt-1">{sub}</p>
    </div>
  </div>
);

const SkeletonCard = () => <div className="animate-pulse rounded-xl bg-slate-200 h-28" />;

const Dashboard: React.FC<DashboardProps> = ({ currentUser }) => {
  const [boardData, setBoardData] = useState<BoardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    api.get<BoardData>("/api/board")
      .then(({ data }) => setBoardData(data))
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Chào buổi sáng" : hour < 18 ? "Chào buổi chiều" : "Chào buổi tối";
  const firstName = currentUser.name?.split(" ").pop() || "bạn";

  if (isLoading) {
    return (
      <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-50 space-y-5">
        <div className="h-12 bg-slate-200 rounded-xl animate-pulse w-72" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <SkeletonCard key={i} />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 h-64 bg-slate-200 rounded-xl animate-pulse" />
          <div className="h-64 bg-slate-200 rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (!boardData) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 bg-slate-50">
        <div className="text-center">
          <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-3">
            <Warning size={28} className="text-red-500" />
          </div>
          <p className="font-semibold text-slate-700">Không thể tải dữ liệu</p>
          <p className="text-sm text-slate-400 mt-1">Vui lòng thử lại sau</p>
        </div>
      </div>
    );
  }

  const tasks = Object.values(boardData.tasks);
  const columnOrder = boardData.columnOrder;
  const firstColId = columnOrder[0];
  const lastColId = columnOrder[columnOrder.length - 1];

  const totalCustomers = tasks.length;
  const totalRevenue = tasks.reduce((sum, t) => sum + parsePrice(t.price), 0);
  const wonCount = boardData.columns[lastColId]?.taskIds.length || 0;
  const newLeads = boardData.columns[firstColId]?.taskIds.length || 0;
  const inProgressCount = totalCustomers - wonCount - newLeads;
  const winRate = totalCustomers > 0 ? Math.round((wonCount / totalCustomers) * 100) : 0;

  const currentYear = new Date().getFullYear();
  const revenueByMonth: Record<number, number> = {};
  tasks.forEach(task => {
    const date = new Date(task.createdAt);
    if (date.getFullYear() === currentYear) {
      const m = date.getMonth();
      revenueByMonth[m] = (revenueByMonth[m] || 0) + parsePrice(task.price);
    }
  });
  const revenueData = MONTHS.map((name, i) => ({
    name, "Doanh thu (Tr)": Math.round((revenueByMonth[i] || 0) / 1_000_000),
  }));

  const visaTypeCount: Record<string, number> = {};
  tasks.forEach(t => { const key = t.visaType || "Chưa xác định"; visaTypeCount[key] = (visaTypeCount[key] || 0) + 1; });
  const visaData = Object.entries(visaTypeCount).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, value]) => ({ name, value }));

  const sourceCount: Record<string, number> = {};
  tasks.forEach(t => { const key = t.source || "Khác"; sourceCount[key] = (sourceCount[key] || 0) + 1; });
  const sourceData = Object.entries(sourceCount).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));

  const recentCustomers = [...tasks].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 6);

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-50 space-y-5">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">{greeting}, {firstName}!</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {new Date().toLocaleDateString("vi-VN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
        <span className="hidden md:flex items-center gap-2 text-xs bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-500">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          Dữ liệu realtime
        </span>
      </div>

      {/* STAT CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <StatCard
          title="Tổng khách hàng"
          value={totalCustomers.toString()}
          sub={`${newLeads} lead mới chưa xử lý`}
          iconBg="bg-blue-50"
          icon={<UsersThree size={22} weight="duotone" className="text-blue-500" />}
        />
        <StatCard
          title="Doanh thu dự kiến"
          value={formatFullRevenue(totalRevenue)}
          sub="Tổng giá trị hợp đồng"
          iconBg="bg-orange-50"
          icon={<CurrencyCircleDollar size={22} weight="duotone" className="text-orange-500" />}
        />
        <StatCard
          title="Đang xử lý"
          value={inProgressCount.toString()}
          sub="Khách đang trong pipeline"
          iconBg="bg-violet-50"
          icon={<ArrowsClockwise size={22} weight="duotone" className="text-violet-500" />}
        />
        <StatCard
          title="Đã hoàn thành"
          value={wonCount.toString()}
          sub={`Tỉ lệ chốt: ${winRate}%`}
          iconBg="bg-emerald-50"
          icon={<CheckCircle size={22} weight="duotone" className="text-emerald-500" />}
          trend={`${winRate}%`}
        />
      </div>

      {/* CHARTS ROW */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-slate-700">Doanh thu theo tháng</h3>
            <p className="text-2xs uppercase tracking-widest text-slate-400 font-semibold mt-0.5">Năm {currentYear} · Triệu đồng</p>
          </div>
          <div className="h-52 min-h-[13rem] w-full min-w-0">
            <ResponsiveContainer width="100%" height={208} minWidth={0}>
              <BarChart data={revenueData} barSize={20}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#94a3b8" }} />
                <YAxis tickFormatter={formatRevenueMillion} width={48} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#94a3b8" }} />
                <Tooltip cursor={{ fill: "#f8fafc" }} formatter={(value) => [`${value ?? 0} Triệu đ`, "Doanh thu"]} contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} />
                <Bar dataKey="Doanh thu (Tr)" fill="#f97316" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-0.5">Cơ cấu dịch vụ</h3>
          <p className="text-2xs uppercase tracking-widest text-slate-400 font-semibold mb-3">Phân bổ theo loại visa</p>
          {visaData.length > 0 ? (
            <div className="h-52 min-h-[13rem] w-full min-w-0">
              <ResponsiveContainer width="100%" height={208} minWidth={0}>
                <PieChart>
                  <Pie data={visaData} innerRadius={50} outerRadius={75} dataKey="value" stroke="none">
                    {visaData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(value, name) => [value ?? 0, name]} contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-52 flex items-center justify-center text-slate-400 text-sm">Chưa có dữ liệu</div>
          )}
        </div>
      </div>

      {/* BOTTOM ROW */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-0.5">Nguồn khách hàng</h3>
          <p className="text-2xs uppercase tracking-widest text-slate-400 font-semibold mb-4">Phân bổ theo kênh tiếp thị</p>
          {sourceData.length > 0 ? (
            <div className="space-y-3">
              {sourceData.slice(0, 6).map((src, i) => {
                const pct = Math.round((src.value / totalCustomers) * 100);
                return (
                  <div key={src.name}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-slate-700">{src.name}</span>
                      <span className="text-sm font-bold text-slate-800">{src.value} <span className="text-xs font-normal text-slate-400">({pct}%)</span></span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5">
                      <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-slate-400 text-center py-8">Chưa có dữ liệu</p>
          )}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-700">Khách hàng gần đây</h3>
              <p className="text-2xs uppercase tracking-widest text-slate-400 font-semibold mt-0.5">6 khách hàng mới nhất</p>
            </div>
            <NavLink to="/crm" className="text-xs font-semibold text-orange-500 hover:text-orange-600 transition-colors">
              Xem tất cả →
            </NavLink>
          </div>
          {recentCustomers.length > 0 ? (
            <div className="space-y-2">
              {recentCustomers.map(task => (
                <div key={task.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 transition-colors">
                  <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 font-bold text-sm flex items-center justify-center shrink-0 uppercase">
                    {task.content?.charAt(0) || "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{task.content}</p>
                    <p className="text-xs text-slate-400 truncate">{task.visaType || "Chưa xác định"} · {task.assignedTo || "Chưa giao"}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-bold text-emerald-600">{task.price || "—"}</p>
                    <p className="text-2xs text-slate-400">{task.createdAt ? new Date(task.createdAt).toLocaleDateString("vi-VN") : "—"}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-slate-400">
              <UsersIcon size={36} className="mb-2" />
              <p className="text-sm">Chưa có khách hàng</p>
            </div>
          )}
        </div>
      </div>

      {/* AI INSIGHTS + CHARTS */}
      <AIInsightsPanel />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PipelineFunnelChart />
        <EmployeePerformanceChart />
      </div>

      <RevenueForecastChart />

      {/* QUICK ACTIONS */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Truy cập nhanh</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {[
            { to: "/crm", label: "Khách hàng", icon: <UsersIcon size={24} weight="duotone" />, color: "text-blue-500 bg-blue-50 hover:bg-blue-100 hover:border-blue-300" },
            { to: "/kpi", label: "Giao việc", icon: <ClipboardText size={24} weight="duotone" />, color: "text-violet-500 bg-violet-50 hover:bg-violet-100 hover:border-violet-300" },
            { to: "/hr", label: "Chấm công", icon: <Clock size={24} weight="duotone" />, color: "text-emerald-500 bg-emerald-50 hover:bg-emerald-100 hover:border-emerald-300" },
            { to: "/documents", label: "Tài liệu", icon: <FolderOpen size={24} weight="duotone" />, color: "text-amber-500 bg-amber-50 hover:bg-amber-100 hover:border-amber-300" },
            { to: "/services", label: "Dịch vụ", icon: <Tag size={24} weight="duotone" />, color: "text-rose-500 bg-rose-50 hover:bg-rose-100 hover:border-rose-300" },
          ].map(({ to, label, icon, color }) => (
            <NavLink
              key={to}
              to={to}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border border-slate-200 transition-all hover:shadow-sm ${color}`}
            >
              {icon}
              <span className="text-xs font-semibold">{label}</span>
            </NavLink>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
