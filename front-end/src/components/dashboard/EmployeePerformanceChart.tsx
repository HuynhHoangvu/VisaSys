import React, { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";
import api from "../../services/api";

interface EmpPerf { name: string; revenue: number; deals: number }

const COLORS = ["#f97316", "#fb923c", "#fdba74", "#fed7aa", "#ffedd5"];

const EmployeePerformanceChart: React.FC = () => {
  const [data, setData] = useState<EmpPerf[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<EmpPerf[]>("/api/stats/employee-performance?top=5")
      .then(({ data }) => setData(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="animate-pulse h-64 bg-slate-100 rounded-xl" />;
  if (!data.length) return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-center justify-center h-64">
      <p className="text-sm text-slate-400">Chưa có dữ liệu doanh số</p>
    </div>
  );

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <h3 className="text-sm font-semibold text-slate-700 mb-0.5">Top Nhân viên Doanh thu</h3>
      <p className="text-2xs uppercase tracking-widest font-semibold text-slate-400 mb-4">Dựa trên SalesRecord toàn thời gian</p>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 5, right: 10 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}Tr`} />
          <Tooltip formatter={(v: number) => [`${v} triệu đồng`, "Doanh thu"]} />
          <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-3 flex flex-wrap gap-2">
        {data.map((e, i) => (
          <span key={i} className="text-xs bg-orange-50 text-orange-700 rounded-full px-2.5 py-0.5 font-medium">
            {e.name}: {e.deals} hợp đồng
          </span>
        ))}
      </div>
    </div>
  );
};

export default EmployeePerformanceChart;
