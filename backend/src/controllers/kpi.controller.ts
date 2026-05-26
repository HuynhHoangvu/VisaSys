import { Request, Response } from "express";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { getWeeklyKPIService, updateWeeklyKPIService } from "../services/kpi.service.js";

export const getWeeklyKPI = asyncHandler(async (req: Request, res: Response) => {
  try {
    const { weekLabel } = req.query;
    if (!weekLabel || typeof weekLabel !== "string") {
      return res.status(400).json({ error: "Thiếu tham số weekLabel" });
    }

    const data = await getWeeklyKPIService(weekLabel);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Lỗi lấy dữ liệu KPI" });
  }
});

export const updateWeeklyKPI = asyncHandler(async (req: Request, res: Response) => {
  try {
    const { weekLabel, data } = req.body;
    if (!weekLabel || !data) {
      return res.status(400).json({ error: "Thiếu dữ liệu" });
    }

    const updatedKPI = await updateWeeklyKPIService(weekLabel, data);
    res.json({ message: "Đã lưu KPI thành công", updatedKPI });
  } catch (error) {
    res.status(500).json({ error: "Lỗi lưu dữ liệu KPI" });
  }
});