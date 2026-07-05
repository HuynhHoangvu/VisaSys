import React, { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, LabelList,
} from "recharts";
import api from "../../services/api";

interface FunnelItem { stage: string; count: number }

const COLORS = ["#6366f1", "#8b5cf6", "#a78bfa", "#c4b5fd", "#ddd6fe", "#ede9fe"];

const PipelineFunnelChart: React.FC = () => {
  const [data, setData] = useState<FunnelItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<FunnelItem[]>("/api/stats/pipeline-funnel")
      .then(({ data }) => setData(data.filter((d) => d.count > 0)))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="animate-pulse h-64 bg-slate-100 rounded-xl" />;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <h3 className="text-sm font-semibold text-slate-700 mb-0.5">Pipeline Khách hàng</h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} layout="vertical" margin={{ left: 10, right: 40 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 11 }} />
          <YAxis type="category" dataKey="stage" tick={{ fontSize: 11 }} width={110} />
          <Tooltip formatter={(v: number | undefined) => [`${v ?? 0} khách`, "Số lượng"]} />
          <Bar dataKey="count" radius={[0, 4, 4, 0]}>
            <LabelList dataKey="count" position="right" style={{ fontSize: 11, fill: "#374151" }} />
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default PipelineFunnelChart;
