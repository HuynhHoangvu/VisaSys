import { Request, Response } from "express";
import { prisma } from "../../lib/prisma.js";
import { getIO } from "../socket.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { CHECKOUT_HOUR } from "../constants/index.js";

/** Returns the number of weekdays (Mon–Fri) in a given month. Used to prorate daily wages. */
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
  let { date, inTime, outTime, status, fine } = req.body;

  // Use Intl.DateTimeFormat to get the current date in Asia/Ho_Chi_Minh timezone
  // rather than relying on the server's local timezone, which may differ in production.
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(now);
  let vnYear = "", vnMonth = "", vnDay = "";
  parts.forEach((p) => {
    if (p.type === "year") vnYear = p.value;
    if (p.type === "month") vnMonth = p.value;
    if (p.type === "day") vnDay = p.value;
  });

  const todayISO = `${vnYear}-${vnMonth}-${vnDay}`;

  // If the employee has an approved leave covering today, waive the fine
  // and relabel a late-arrival status to indicate it was excused.
  const approvedLeave = await prisma.leaveRequest.findFirst({
    where: {
      employeeId: id,
      status: "Đã duyệt",
      startDate: { lte: todayISO },
      endDate: { gte: todayISO },
    },
  });

  if (approvedLeave) {
    fine = 0;
    if (status === "Đi muộn") status = "Đi muộn (Có phép)";
  }

  const newRecord = await prisma.attendanceRecord.create({
    data: { date, inTime, outTime, status, fine, employeeId: id },
  });

  getIO().emit("data_changed");
  res.status(201).json(newRecord);
});

export const checkOutEmployee = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const now = new Date();
  const timeZone = "Asia/Ho_Chi_Minh";

  const todayStr = now.toLocaleDateString("vi-VN", { timeZone });
  const outTime = now.toLocaleTimeString("vi-VN", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
  } as Intl.DateTimeFormatOptions);

  // Parse hour/minute in VN timezone to detect early leave accurately.
  // Using formatToParts avoids locale-dependent string parsing bugs.
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "numeric",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour12: false,
  } as Intl.DateTimeFormatOptions);

  const parts = formatter.formatToParts(now);
  let vnHour = 0, vnMinute = 0, vnYear = "", vnMonth = "", vnDay = "";
  parts.forEach((p) => {
    if (p.type === "hour") vnHour = parseInt(p.value, 10) % 24;
    if (p.type === "minute") vnMinute = parseInt(p.value, 10);
    if (p.type === "year") vnYear = p.value;
    if (p.type === "month") vnMonth = p.value;
    if (p.type === "day") vnDay = p.value;
  });

  const todayRecord = await prisma.attendanceRecord.findFirst({
    where: { employeeId: id, date: todayStr },
  });

  if (!todayRecord) {
    return res.status(400).json({ error: "Chưa check-in hôm nay!" });
  }
  if (todayRecord.outTime && todayRecord.outTime !== "-") {
    return res.status(400).json({ error: "Đã check-out rồi!" });
  }

  // An early leave is any checkout before the standard end-of-day hour.
  // If not covered by an approved leave, deduct half a day's wage.
  const outMinutes = vnHour * 60 + vnMinute;
  const isEarlyLeave = outMinutes < CHECKOUT_HOUR * 60;
  let halfDayDeduction = 0;
  let newStatus = todayRecord.status;

  if (isEarlyLeave) {
    const todayISO = `${vnYear}-${vnMonth}-${vnDay}`;

    const approvedLeave = await prisma.leaveRequest.findFirst({
      where: {
        employeeId: id,
        status: "Đã duyệt",
        startDate: { lte: todayISO },
        endDate: { gte: todayISO },
      },
    });

    if (!approvedLeave) {
      const employee = await prisma.employee.findUnique({ where: { id } });
      const workDays = getWorkDaysInMonth(parseInt(vnYear), parseInt(vnMonth) - 1);
      halfDayDeduction = Math.round((employee!.baseSalary || 0) / workDays / 2);

      newStatus =
        todayRecord.status === "Đúng giờ" || todayRecord.status.includes("Có phép")
          ? "Về sớm"
          : `${todayRecord.status} + Về sớm`;
    } else {
      newStatus =
        todayRecord.status === "Đúng giờ" || todayRecord.status.includes("Có phép")
          ? "Về sớm (Có phép)"
          : `${todayRecord.status} + Về sớm (Có phép)`;
    }
  }

  // Chỉ cập nhật attendanceRecord — halfDayDeduction đã được tính
  // trong salary.controller qua newHalfDay, không cần tạo salesRecord
  // riêng để tránh bị trừ 2 lần khi chốt lương.
  await prisma.attendanceRecord.update({
    where: { id: todayRecord.id },
    data: { outTime, status: newStatus, halfDayDeduction },
  });

  getIO().emit("data_changed");
  res.json({ success: true, isEarlyLeave, halfDayDeduction, outTime, hasLeaveApproval: halfDayDeduction === 0 });
});

export const addManualBonus = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { customer, service, profit, note } = req.body;

  const newRecord = await prisma.salesRecord.create({
    data: { employeeId: id, customer, service, profit: Number(profit), note },
  });

  getIO().emit("data_changed");
  res.status(201).json(newRecord);
});

/**
 * Pure business logic for penalizing employees who forgot to check out.
 * Extracted from the HTTP controller so the nightly cron job can call it
 * directly without constructing a fake req/res pair.
 */
export const runPenalizeForgotCheckout = async (): Promise<{ penalized: number }> => {
  const now = new Date();
  const todayStr = now.toLocaleDateString("vi-VN");

  const forgotRecords = await prisma.attendanceRecord.findMany({
    where: { date: todayStr, outTime: "-", halfDayDeduction: 0 },
    include: { employee: true },
  });

  if (forgotRecords.length === 0) return { penalized: 0 };

  const workDays = getWorkDaysInMonth(now.getFullYear(), now.getMonth());

  // Chỉ cập nhật attendanceRecord — halfDayDeduction đã được tính
  // trong salary.controller qua newHalfDay, không tạo salesRecord
  // riêng để tránh bị trừ 2 lần khi chốt lương.
  await prisma.$transaction(async (tx) => {
    for (const record of forgotRecords) {
      const halfDayDeduction = Math.round((record.employee.baseSalary || 0) / workDays / 2);

      await tx.attendanceRecord.update({
        where: { id: record.id },
        data: { outTime: "Quên checkout", status: "Quên checkout", halfDayDeduction },
      });
    }
  });

  return { penalized: forgotRecords.length };
};

export const penalizeForgotCheckout = asyncHandler(async (_req: Request, res: Response) => {
  const result = await runPenalizeForgotCheckout();
  res.json({ success: true, ...result });
});
