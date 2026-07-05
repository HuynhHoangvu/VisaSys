import { Request, Response } from "express";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { prisma } from "../../lib/prisma.js";
import { cacheGet, cacheSet } from "../../lib/redis.js";

// Tỷ lệ chuyển đổi & doanh thu theo tháng (N tháng gần nhất)
export const getConversionTrend = asyncHandler(async (req: Request, res: Response) => {
  const months = parseInt(req.query.months as string) || 6;

  const columns = await prisma.column.findMany({ select: { id: true, title: true } });
  const closedColumnIds = columns
    .filter((c) => c.title.toLowerCase().includes("hoàn") || c.title.toLowerCase().includes("đóng") || c.title.toLowerCase().includes("xong") || c.title.toLowerCase().includes("thành công"))
    .map((c) => c.id);

  const now = new Date();
  const result: { month: string; total: number; closed: number; rate: number; revenue: number }[] = [];

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const start = new Date(d.getFullYear(), d.getMonth(), 1);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);

    const [total, closed] = await Promise.all([
      prisma.task.count({ where: { createdAt: { gte: start, lte: end } } }),
      prisma.task.count({
        where: {
          createdAt: { gte: start, lte: end },
          columnId: { in: closedColumnIds.length ? closedColumnIds : ["__none__"] },
        },
      }),
    ]);

    const revenue = await prisma.task.findMany({
      where: { createdAt: { gte: start, lte: end } },
      select: { price: true },
    });
    const totalRevenue = revenue.reduce((sum, t) => {
      return sum + (parseInt(t.price.replace(/[^0-9]/g, "")) || 0);
    }, 0);

    result.push({
      month: `T${d.getMonth() + 1}/${d.getFullYear()}`,
      total,
      closed,
      rate: total > 0 ? Math.round((closed / total) * 100) : 0,
      revenue: Math.round(totalRevenue / 1_000_000), // triệu đồng
    });
  }

  res.json(result);
});

// Pipeline funnel: số lượng task theo từng column stage
export const getPipelineFunnel = asyncHandler(async (_req: Request, res: Response) => {
  const CACHE_KEY = "stats:pipeline-funnel";
  const cached = await cacheGet(CACHE_KEY);
  if (cached) return res.json(JSON.parse(cached));

  const columns = await prisma.column.findMany({
    orderBy: { order: "asc" },
    select: { id: true, title: true },
  });

  const counts = await Promise.all(
    columns.map(async (col) => ({
      stage: col.title,
      count: await prisma.task.count({ where: { columnId: col.id } }),
    })),
  );

  await cacheSet(CACHE_KEY, JSON.stringify(counts), 120); // cache 2 phút
  res.json(counts);
});

// Top N nhân viên theo tổng doanh thu SalesRecord
export const getEmployeePerformance = asyncHandler(async (req: Request, res: Response) => {
  const top = parseInt(req.query.top as string) || 5;

  const records = await prisma.salesRecord.groupBy({
    by: ["employeeId"],
    _sum: { profit: true },
    _count: { id: true },
    orderBy: { _sum: { profit: "desc" } },
    take: top,
  });

  const employeeIds = records.map((r) => r.employeeId);
  const employees = await prisma.employee.findMany({
    where: { id: { in: employeeIds } },
    select: { id: true, name: true },
  });
  const nameMap = Object.fromEntries(employees.map((e) => [e.id, e.name]));

  const result = records.map((r) => ({
    name: nameMap[r.employeeId] ?? r.employeeId,
    revenue: Math.round((r._sum.profit ?? 0) / 1_000_000), // triệu
    deals: r._count.id,
  }));

  res.json(result);
});

// Dự báo doanh thu tháng tới bằng linear regression
export const getRevenueForecast = asyncHandler(async (_req: Request, res: Response) => {
  const now = new Date();
  const months = 6;
  const dataPoints: { x: number; y: number; label: string }[] = [];

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const start = new Date(d.getFullYear(), d.getMonth(), 1);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);

    const tasks = await prisma.task.findMany({
      where: { createdAt: { gte: start, lte: end } },
      select: { price: true },
    });
    const rev = tasks.reduce((s, t) => s + (parseInt(t.price.replace(/[^0-9]/g, "")) || 0), 0);
    dataPoints.push({ x: months - 1 - i, y: Math.round(rev / 1_000_000), label: `T${d.getMonth() + 1}` });
  }

  // Simple linear regression y = a + b*x
  const n = dataPoints.length;
  const sumX = dataPoints.reduce((s, p) => s + p.x, 0);
  const sumY = dataPoints.reduce((s, p) => s + p.y, 0);
  const sumXY = dataPoints.reduce((s, p) => s + p.x * p.y, 0);
  const sumX2 = dataPoints.reduce((s, p) => s + p.x * p.x, 0);
  const b = n > 1 ? (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX) : 0;
  const a = (sumY - b * sumX) / n;
  const forecastX = n;
  const forecastY = Math.max(0, Math.round(a + b * forecastX));

  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const forecastLabel = `T${nextMonth.getMonth() + 1}`;

  res.json({
    historical: dataPoints,
    forecast: { label: forecastLabel, value: forecastY, x: forecastX },
  });
});

// Nguồn khách hàng theo tháng (stacked)
export const getSourceTrend = asyncHandler(async (req: Request, res: Response) => {
  const months = parseInt(req.query.months as string) || 6;
  const now = new Date();

  const sources: string[] = [];
  const monthData: { month: string; [key: string]: number | string }[] = [];

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const start = new Date(d.getFullYear(), d.getMonth(), 1);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);

    const tasks = await prisma.task.findMany({
      where: { createdAt: { gte: start, lte: end } },
      select: { source: true },
    });

    const grouped: { [key: string]: number } = {};
    tasks.forEach((t) => {
      const src = t.source || "Khác";
      grouped[src] = (grouped[src] || 0) + 1;
      if (!sources.includes(src)) sources.push(src);
    });

    monthData.push({ month: `T${d.getMonth() + 1}`, ...grouped });
  }

  res.json({ sources, data: monthData });
});
