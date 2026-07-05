import React, { useEffect, useState } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import api from "../../services/api";

interface HistPoint { x: number; y: number; label: string }
interface ForecastData {
  historical: HistPoint[];
  forecast: { label: string; value: number; x: number };
}

const RevenueForecastChart: React.FC = () => {
  const [data, setData] = useState<ForecastData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<ForecastData>("/api/stats/forecast")
      .then(({ data }) => setData(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="animate-pulse h-64 bg-slate-100 rounded-xl" />;
  if (!data) return null;

  const chartData = [
    ...data.historical.map((p) => ({ name: p.label, actual: p.y, forecast: undefined as number | undefined })),
    { name: data.forecast.label, actual: undefined as number | undefined, forecast: data.forecast.value },
  ];

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-700">Dự báo Doanh thu</h3>
          <p className="text-2xs uppercase tracking-widest font-semibold text-slate-400 mt-0.5">Linear trend 6 tháng gần nhất</p>
        </div>
        <div className="bg-blue-50 rounded-lg px-3 py-1.5 text-right">
          <p className="text-xs text-blue-500 font-medium">Dự báo {data.forecast.label}</p>
          <p className="text-lg font-bold text-blue-600">{data.forecast.value}Tr</p>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={chartData} margin={{ top: 5, right: 10 }}>
          <defs>
            <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorForecast" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}Tr`} />
          <Tooltip formatter={(v: number | undefined) => [`${v ?? 0} triệu đồng`]} />
          <ReferenceLine
            x={data.forecast.label}
            stroke="#f59e0b"
            strokeDasharray="4 4"
            label={{ value: "Dự báo", position: "top", fontSize: 10, fill: "#f59e0b" }}
          />
          <Area
            type="monotone" dataKey="actual" stroke="#3b82f6" strokeWidth={2}
            fill="url(#colorActual)" connectNulls={false} name="Thực tế"
          />
          <Area
            type="monotone" dataKey="forecast" stroke="#f59e0b" strokeWidth={2}
            strokeDasharray="6 3" fill="url(#colorForecast)" connectNulls={false} name="Dự báo"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default RevenueForecastChart;
