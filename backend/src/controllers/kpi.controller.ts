import { Request, Response } from "express";
import { prisma } from "../../lib/prisma.js";

/**
 * Get weekly KPI data for the specified week.
 */
export const getWeeklyKPI = async (req: Request, res: Response) => {
  try {
    const { weekLabel } = req.query;
    
    if (!weekLabel || typeof weekLabel !== "string") {
      return res.status(400).json({ error: "Thiếu tham số weekLabel" });
    }

    const kpiData = await prisma.weeklyKPI.findUnique({
      where: { weekLabel },
    });

    // Return data if available, otherwise null so frontend can use fallback defaults.
    res.json(kpiData ? kpiData.data : null);
  } catch (error) {
    res.status(500).json({ error: "Lỗi lấy dữ liệu KPI" });
  }
};

/**
 * Create or update weekly KPI data using upsert.
 */
export const updateWeeklyKPI = async (req: Request, res: Response) => {
  try {
    const { weekLabel, data } = req.body;

    if (!weekLabel || !data) {
      return res.status(400).json({ error: "Thiếu dữ liệu" });
    }

    // Upsert: update existing record if it exists, otherwise create a new one.
    const updatedKPI = await prisma.weeklyKPI.upsert({
      where: { weekLabel },
      update: { data },
      create: { weekLabel, data },
    });

    res.json({ message: "Đã lưu KPI thành công", updatedKPI });
  } catch (error) {
    res.status(500).json({ error: "Lỗi lưu dữ liệu KPI" });
  }
};