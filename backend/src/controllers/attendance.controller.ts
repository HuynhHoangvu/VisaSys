import { Request, Response } from "express";
import { getIO } from "../socket.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import {
  checkInEmployeeService,
  checkOutEmployeeService,
  addManualBonusService,
  deleteSalesRecordService,
  waiveHalfDayDeductionService,
  waiveAttendanceFineService,
  excuseScheduledAbsenceService,
  runPenalizeForgotCheckoutService,
} from "../services/attendance.service.js";

/** Returns the number of weekdays (Mon–Fri) in a given month. Legacy helper — chỗ khấu nửa ngày dùng STANDARD_WORK_DAYS (22). */
export const getWorkDaysInMonth = (year: number, month: number): number => {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  let count = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const day = new Date(year, month, d).getDay();
    if (day !== 0 && day !== 6) count++;
  }
  return count;
};

export const checkInEmployee = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const newRecord = await checkInEmployeeService(id, req.body);
  getIO().emit("data_changed");
  res.status(201).json(newRecord);
});

export const checkOutEmployee = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  try {
    const result = await checkOutEmployeeService(id);
    getIO().emit("data_changed");
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export const addManualBonus = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const newRecord = await addManualBonusService(id, req.body);
  getIO().emit("data_changed");
  res.status(201).json(newRecord);
});

export const deleteSalesRecord = asyncHandler(async (req: Request, res: Response) => {
  const employeeId = req.params.id as string;
  const salesRecordId = req.params.salesRecordId as string;

  try {
    await deleteSalesRecordService(employeeId, salesRecordId);
    getIO().emit("data_changed");
    res.json({ success: true });
  } catch (error: any) {
    res.status(404).json({ error: error.message });
  }
});

export const waiveHalfDayDeduction = asyncHandler(async (req: Request, res: Response) => {
  const employeeId = req.params.id as string;
  const recordId = req.params.recordId as string;

  try {
    const updated = await waiveHalfDayDeductionService(employeeId, recordId);
    getIO().emit("data_changed");
    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export const waiveAttendanceFine = asyncHandler(async (req: Request, res: Response) => {
  const employeeId = req.params.id as string;
  const recordId = req.params.recordId as string;

  try {
    const updated = await waiveAttendanceFineService(employeeId, recordId);
    getIO().emit("data_changed");
    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export const excuseScheduledAbsence = asyncHandler(async (req: Request, res: Response) => {
  const employeeId = req.params.id as string;
  const { date } = (req.body || {}) as { date?: string };
  const targetDate = String(date || "").trim();

  try {
    const record = await excuseScheduledAbsenceService(employeeId, targetDate);
    getIO().emit("data_changed");
    res.json(record);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export const runPenalizeForgotCheckout = async (): Promise<{ penalized: number }> => {
  return runPenalizeForgotCheckoutService();
};

export const penalizeForgotCheckout = asyncHandler(async (_req: Request, res: Response) => {
  const result = await runPenalizeForgotCheckout();
  res.json({ success: true, ...result });
});
