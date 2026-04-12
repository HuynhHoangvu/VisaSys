import { Request, Response } from "express";
import { prisma } from "../../lib/prisma.js";
import { getIO } from "../socket.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import {
  SALARY_THRESHOLD,
  BHXH_NLD_RATE, BHYT_NLD_RATE, BHTN_NLD_RATE,
  BONUS_CHUYÊN_CẦN, BONUS_ĂN_TRƯA, BONUS_HỖ_TRỢ_KHÁC,
} from "../constants/index.js";

/**
 * Locks payroll for a given month (format: "MM/YYYY").
 *
 * This is an accumulative upsert: calling it multiple times for the same month
 * adds the new raw data on top of what was already finalized. This supports
 * mid-month partial locks (e.g., locking twice before month-end).
 *
 * After persisting the salary history snapshot, all raw attendance and sales
 * records for that period are deleted so they don't get double-counted next time.
 */
export const finalizeMonthSalary = asyncHandler(async (req: Request, res: Response) => {
  const { monthYear } = req.body;
  if (!monthYear) return res.status(400).json({ error: "Vui lòng cung cấp tháng chốt lương!" });

  const [mmStr, yyyyStr] = monthYear.split("/");
  const mm   = parseInt(mmStr);
  const yyyy = parseInt(yyyyStr);

  const monthStart = new Date(yyyy, mm - 1, 1);
  const monthEnd   = new Date(yyyy, mm, 1);

  // Filter records at the DB level to avoid loading all historical data into memory.
  const employees = await prisma.employee.findMany({
    include: {
      attendanceRecords: {
        where: { date: { contains: `/${String(mm).padStart(2, "0")}/${yyyy}` } },
      },
      salesRecords: {
        where: { createdAt: { gte: monthStart, lt: monthEnd } },
      },
    },
  });

  await prisma.$transaction(async (tx) => {
    const attIdsToDelete: string[]  = [];
    const saleIdsToDelete: string[] = [];

    for (const emp of employees) {
      const monthAtt   = emp.attendanceRecords;
      const monthSales = emp.salesRecords;

      monthAtt.forEach((r) => attIdsToDelete.push(r.id));
      monthSales.forEach((r) => saleIdsToDelete.push(r.id));

      // Tally new figures from raw records
      let newHoaHong = 0, newTamUng = 0, newManualFines = 0;
      monthSales.forEach((r) => {
        const amount = Number(r.profit) || 0;
        if (r.service === "Phạt") newManualFines += Math.abs(amount);
        else if (r.service === "Tạm ứng") newTamUng += Math.abs(amount);
        else if (!["Chuyên cần", "Ăn trưa", "Hỗ trợ khác"].includes(r.service || ""))
          newHoaHong += amount;
      });

      const newAttendanceFines = monthAtt.reduce((s, r) => s + (r.fine || 0), 0);
      const newHalfDay         = monthAtt.reduce((s, r) => s + (r.halfDayDeduction || 0), 0);

      // Insurance base salary is capped: if gross >= threshold, deduct 2M before calculating insurance.
      const totalSalaryBrutto = emp.baseSalary || 0;
      const ins = totalSalaryBrutto >= SALARY_THRESHOLD ? totalSalaryBrutto - 2_000_000 : totalSalaryBrutto;

      const newFullDay = monthAtt.reduce(
        (s, r) => (r.status === "Vắng không phép" ? s + Math.round(ins / 21) : s),
        0
      );

      const newWorkDates = monthAtt
        .filter((r) => r.outTime && r.outTime !== "-" && r.outTime !== "Quên checkout")
        .map((r) => r.date);

      // Check if this month was already partially finalized
      const existing = await tx.salaryHistory.findFirst({
        where: { employeeId: emp.id, monthYear },
      });

      // Accumulate: add new figures on top of previously saved ones
      const finalHoaHong         = (existing?.hoaHong || 0) + newHoaHong;
      const finalTamUng          = (existing?.tamUng || 0) + newTamUng;
      const finalManualFines     = (existing?.manualFines || 0) + newManualFines;
      const finalAttendanceFines = (existing?.attendanceFines || 0) + newAttendanceFines;
      const finalHalfDay         = (existing?.halfDayDeduction || 0) + newHalfDay;
      const finalFullDay         = (existing?.fullDayAbsenceDeduction || 0) + newFullDay;

      // Use a Set to deduplicate work dates across multiple finalization calls
      const finalWorkDates = Array.from(new Set([...(existing?.workDates || []), ...newWorkDates]));
      const finalWorkDays  = finalWorkDates.length;

      const cc  = totalSalaryBrutto >= SALARY_THRESHOLD ? BONUS_CHUYÊN_CẦN  : 0;
      const at  = totalSalaryBrutto >= SALARY_THRESHOLD ? BONUS_ĂN_TRƯA     : 0;
      const htk = totalSalaryBrutto >= SALARY_THRESHOLD ? BONUS_HỖ_TRỢ_KHÁC : 0;

      const bhxhNld  = Math.round(ins * BHXH_NLD_RATE);
      const bhytNld  = Math.round(ins * BHYT_NLD_RATE);
      const bhtnNld  = Math.round(ins * BHTN_NLD_RATE);
      const totalNld = bhxhNld + bhytNld + bhtnNld;

      const totalDeductions = finalManualFines + finalAttendanceFines + finalHalfDay + finalFullDay + totalNld;
      const finalSalary     = ins + cc + at + htk + finalHoaHong - finalTamUng - totalDeductions;

      const historyData = {
        baseSalary:              ins,
        totalBonus:              cc + at + htk + finalHoaHong,
        totalDeduction:          totalDeductions + finalTamUng,
        finalSalary,
        hoaHong:                 finalHoaHong,
        tamUng:                  finalTamUng,
        manualFines:             finalManualFines,
        attendanceFines:         finalAttendanceFines,
        halfDayDeduction:        finalHalfDay,
        fullDayAbsenceDeduction: finalFullDay,
        workDays:                finalWorkDays,
        workDates:               finalWorkDates,
      };

      if (existing) {
        await tx.salaryHistory.update({ where: { id: existing.id }, data: historyData });
      } else {
        await tx.salaryHistory.create({
          data: { ...historyData, monthYear, employeeId: emp.id },
        });
      }
    }

    // Delete raw records only after the snapshot is safely written
    if (attIdsToDelete.length > 0)  await tx.attendanceRecord.deleteMany({ where: { id: { in: attIdsToDelete } } });
    if (saleIdsToDelete.length > 0) await tx.salesRecord.deleteMany({ where: { id: { in: saleIdsToDelete } } });
  });

  getIO().emit("data_changed");
  res.status(200).json({ message: "Chốt lương thành công!" });
});

export const getSalaryHistory = asyncHandler(async (_req: Request, res: Response) => {
  const history = await prisma.salaryHistory.findMany({
    include: {
      employee: { select: { id: true, name: true, employeeCode: true, department: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  res.json(history);
});
