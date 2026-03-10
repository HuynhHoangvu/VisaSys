import { Request, Response } from "express";
import { prisma } from "../../lib/prisma.js";

// Lấy dữ liệu KPI theo tuần
export const getWeeklyKPI = async (req: Request, res: Response) => {
  try {
    const { weekLabel } = req.query;
    
    if (!weekLabel || typeof weekLabel !== "string") {
      return res.status(400).json({ error: "Thiếu tham số weekLabel" });
    }

    const kpiData = await prisma.weeklyKPI.findUnique({
      where: { weekLabel },
    });

    // Nếu có dữ liệu thì trả về, chưa có thì trả về null (Frontend sẽ tự lấy data mặc định)
    res.json(kpiData ? kpiData.data : null);
  } catch (error) {
    res.status(500).json({ error: "Lỗi lấy dữ liệu KPI" });
  }
};

// Lưu hoặc cập nhật dữ liệu KPI theo tuần (Upsert)
export const updateWeeklyKPI = async (req: Request, res: Response) => {
  try {
    const { weekLabel, data } = req.body;

    if (!weekLabel || !data) {
      return res.status(400).json({ error: "Thiếu dữ liệu" });
    }

    // Upsert: Có rồi thì update, chưa có thì create
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