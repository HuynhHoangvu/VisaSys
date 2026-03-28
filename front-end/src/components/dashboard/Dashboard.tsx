import React, { useState, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import { NavLink } from "react-router-dom";
import api from "../../services/api";
import type { BoardData, AuthUser } from "../../types";

interface DashboardProps {
  currentUser: AuthUser;
}

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
  gradient: string;
  icon: React.ReactNode;
  trend?: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, sub, gradient, icon, trend }) => (
  <div className={`relative overflow-hidden rounded-xl p-5 text-white shadow-lg ${gradient}`}>
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm font-medium text-white/80">{title}</p>
        <p className="text-3xl font-bold mt-1">{value}</p>
        <p className="text-xs mt-1.5 text-white/70">{sub}</p>
      </div>
      <div className="p-3 bg-white/20 rounded-xl">{icon}</div>
    </div>
    {trend && (
      <div className="absolute bottom-3 right-4 text-xs font-semibold bg-white/20 rounded-full px-2 py-0.5">
        {trend}
      </div>
    )}
    <div className="absolute -bottom-4 -right-4 w-24 h-24 rounded-full bg-white/10" />
  </div>
);

const SkeletonCard = () => (
  <div className="animate-pulse rounded-xl bg-gray-200 h-28" />
);

const Dashboard: React.FC<DashboardProps> = ({ currentUser }) => {
  const [boardData, setBoardData] = useState<BoardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    api
      .get<BoardData>("/api/board")
      .then(({ data }) => setBoardData(data))
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Chào buổi sáng" : hour < 18 ? "Chào buổi chiều" : "Chào buổi tối";
  const firstName = currentUser.name?.split(" ").pop() || "bạn";

  if (isLoading) {
    return (
      <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-gray-50 space-y-5">
        <div className="h-12 bg-gray-200 rounded-xl animate-pulse w-72" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <SkeletonCard key={i} />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 h-64 bg-gray-200 rounded-xl animate-pulse" />
          <div className="h-64 bg-gray-200 rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (!boardData) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <p className="font-semibold text-gray-700">Không thể tải dữ liệu</p>
          <p className="text-sm text-gray-500 mt-1">Vui lòng thử lại sau</p>
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

  // Revenue by month (current year)
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
    name,
    "Doanh thu (Tr)": Math.round((revenueByMonth[i] || 0) / 1_000_000),
  }));

  // Visa type distribution
  const visaTypeCount: Record<string, number> = {};
  tasks.forEach(t => {
    const key = t.visaType || "Chưa xác định";
    visaTypeCount[key] = (visaTypeCount[key] || 0) + 1;
  });
  const visaData = Object.entries(visaTypeCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, value]) => ({ name, value }));

  // Source distribution
  const sourceCount: Record<string, number> = {};
  tasks.forEach(t => {
    const key = t.source || "Khác";
    sourceCount[key] = (sourceCount[key] || 0) + 1;
  });
  const sourceData = Object.entries(sourceCount)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, value }));

  // Recent customers
  const recentCustomers = [...tasks]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 6);

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-gray-50 space-y-5">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{greeting}, {firstName}!</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {new Date().toLocaleDateString("vi-VN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
        <span className="hidden md:flex items-center gap-2 text-xs bg-white border border-gray-200 rounded-lg px-3 py-2 text-gray-500 shadow-sm">
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
          gradient="bg-gradient-to-br from-blue-500 to-blue-700"
          icon={
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          }
        />
        <StatCard
          title="Doanh thu dự kiến"
          value={formatFullRevenue(totalRevenue)}
          sub="Tổng giá trị hợp đồng"
          gradient="bg-gradient-to-br from-orange-400 to-orange-600"
          icon={
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <StatCard
          title="Đang xử lý"
          value={inProgressCount.toString()}
          sub="Khách đang trong pipeline"
          gradient="bg-gradient-to-br from-violet-500 to-violet-700"
          icon={
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          }
        />
        <StatCard
          title="Đã hoàn thành"
          value={wonCount.toString()}
          sub={`Tỉ lệ chốt: ${winRate}%`}
          gradient="bg-gradient-to-br from-emerald-500 to-emerald-700"
          trend={`${winRate}%`}
          icon={
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
      </div>

      {/* CHARTS ROW */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Revenue Bar Chart */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-gray-800">Doanh thu theo tháng</h3>
              <p className="text-xs text-gray-500 mt-0.5">Năm {currentYear} • Đơn vị: Triệu đồng</p>
            </div>
          </div>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueData} barSize={20}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#9ca3af" }} />
                <YAxis
                  tickFormatter={formatRevenueMillion}
                  width={48}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: "#9ca3af" }}
                />
                <Tooltip
                  cursor={{ fill: "#f9fafb" }}
                  formatter={(value) => [`${value ?? 0} Triệu đ`, "Doanh thu"]}
                  contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 12 }}
                />
                <Bar dataKey="Doanh thu (Tr)" fill="#f97316" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Visa Type Donut */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h3 className="font-bold text-gray-800 mb-0.5">Cơ cấu dịch vụ</h3>
          <p className="text-xs text-gray-500 mb-3">Phân bổ theo loại visa</p>
          {visaData.length > 0 ? (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={visaData} innerRadius={50} outerRadius={75} dataKey="value" stroke="none">
                    {visaData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name) => [value ?? 0, name]}
                    contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 12 }}
                  />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-52 flex items-center justify-center text-gray-400 text-sm">
              Chưa có dữ liệu
            </div>
          )}
        </div>
      </div>

      {/* BOTTOM ROW */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Source Distribution */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h3 className="font-bold text-gray-800 mb-1">Nguồn khách hàng</h3>
          <p className="text-xs text-gray-500 mb-4">Phân bổ theo kênh tiếp thị</p>
          {sourceData.length > 0 ? (
            <div className="space-y-3">
              {sourceData.slice(0, 6).map((src, i) => {
                const pct = Math.round((src.value / totalCustomers) * 100);
                return (
                  <div key={src.name}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-700">{src.name}</span>
                      <span className="text-sm font-bold text-gray-800">{src.value} <span className="text-xs font-normal text-gray-400">({pct}%)</span></span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                      <div
                        className="h-1.5 rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-8">Chưa có dữ liệu</p>
          )}
        </div>

        {/* Recent Customers */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-gray-800">Khách hàng gần đây</h3>
              <p className="text-xs text-gray-500 mt-0.5">6 khách hàng mới nhất</p>
            </div>
            <NavLink to="/crm" className="text-xs font-semibold text-orange-500 hover:text-orange-600 transition-colors">
              Xem tất cả →
            </NavLink>
          </div>
          {recentCustomers.length > 0 ? (
            <div className="space-y-3">
              {recentCustomers.map(task => (
                <div key={task.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors">
                  <div className="w-9 h-9 rounded-full bg-orange-100 text-orange-600 font-bold text-sm flex items-center justify-center shrink-0 uppercase">
                    {task.content?.charAt(0) || "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{task.content}</p>
                    <p className="text-xs text-gray-500 truncate">
                      {task.visaType || "Chưa xác định"} • {task.assignedTo || "Chưa giao"}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-bold text-emerald-600">{task.price || "—"}</p>
                    <p className="text-[10px] text-gray-400">
                      {task.createdAt ? new Date(task.createdAt).toLocaleDateString("vi-VN") : "—"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-gray-400">
              <svg className="w-10 h-10 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0" />
              </svg>
              <p className="text-sm">Chưa có khách hàng</p>
            </div>
          )}
        </div>
      </div>

      {/* QUICK ACTIONS */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h3 className="font-bold text-gray-800 mb-4">Truy cập nhanh</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {[
            { to: "/crm", label: "Khách hàng", color: "blue", icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg> },
            { to: "/kpi", label: "Giao việc", color: "violet", icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg> },
            { to: "/hr", label: "Chấm công", color: "emerald", icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
            { to: "/documents", label: "Tài liệu", color: "amber", icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg> },
            { to: "/services", label: "Dịch vụ", color: "rose", icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg> },
          ].map(({ to, label, color, icon }) => (
            <NavLink
              key={to}
              to={to}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-dashed transition-all hover:border-solid hover:shadow-sm
                ${color === "blue" ? "border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100 hover:border-blue-400" : ""}
                ${color === "violet" ? "border-violet-200 bg-violet-50 text-violet-600 hover:bg-violet-100 hover:border-violet-400" : ""}
                ${color === "emerald" ? "border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:border-emerald-400" : ""}
                ${color === "amber" ? "border-amber-200 bg-amber-50 text-amber-600 hover:bg-amber-100 hover:border-amber-400" : ""}
                ${color === "rose" ? "border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 hover:border-rose-400" : ""}
              `}
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
