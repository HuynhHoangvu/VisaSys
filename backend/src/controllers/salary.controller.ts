import { Request, Response } from "express";
import { getIO } from "../socket.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import {
  finalizeMonthSalaryService,
  getSalaryHistoryService,
} from "../services/SalaryService.js";

export const finalizeMonthSalary = asyncHandler(async (req: Request, res: Response) => {
  const { monthYear } = req.body;
  try {
    await finalizeMonthSalaryService(monthYear);
    getIO().emit("data_changed");
    res.status(200).json({ message: "Chốt lương thành công!" });
  } catch (error: any) {
    if (error.message === "Vui lòng cung cấp tháng chốt lương!") {
      return res.status(400).json({ error: error.message });
    }
    throw error;
  }
});

export const getSalaryHistory = asyncHandler(async (req: Request, res: Response) => {
  const user = (req.session as any).user;
  const deduped = await getSalaryHistoryService(user);
  res.json(deduped);
});
