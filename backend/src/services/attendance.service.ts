import { prisma } from "../../lib/prisma.js";
import { CHECKOUT_HOUR, STANDARD_WORK_DAYS, HALF_DAY_SPLIT_MINUTES } from "../constants/index.js";
import { isAfternoonOnlyCheckIn } from "./attendancePayroll.js";
import { getVnDateTime } from "../utils/date.js";

const hasApprovedLeaveTypeOnDate = async (
  employeeId: string,
  leaveType: "Vô trễ" | "Về sớm" | "Nghỉ có lương",
  isoDate: string,
): Promise<boolean> => {
  const found = await prisma.leaveRequest.findFirst({
    where: {
      employeeId,
      paidType: leaveType,
      status: "Đã duyệt",
      startDate: { lte: isoDate },
      endDate: { gte: isoDate },
    },
    select: { id: true },
  });
  return !!found;
};

export const checkInEmployeeService = async (
  employeeId: string,
  data: { date: string; inTime: string; outTime?: string; status?: string; fine?: number }
) => {
  const emp = await prisma.employee.findUnique({ where: { id: employeeId } });
  const unitHalf = Math.round((emp?.baseSalary || 0) / STANDARD_WORK_DAYS / 2);
  const { isoDate: todayIsoVN } = getVnDateTime();
  const hasApprovedLateLeave = await hasApprovedLeaveTypeOnDate(employeeId, "Vô trễ", todayIsoVN);

  let halfDayDeduction = 0;
  let resolvedFine = Number(data.fine) || 0;
  let resolvedStatus = String(data.status || "Đúng giờ");

  if (isAfternoonOnlyCheckIn(data.inTime) && !hasApprovedLateLeave) {
    halfDayDeduction = unitHalf;
    resolvedFine = 0;
    resolvedStatus = "Nửa ngày chiều";
  } else if (isAfternoonOnlyCheckIn(data.inTime) && hasApprovedLateLeave) {
    halfDayDeduction = 0;
    resolvedFine = 0;
    resolvedStatus = "Vô trễ (có phép)";
  }

  if (hasApprovedLateLeave) {
    resolvedFine = 0;
    if (resolvedStatus === "Đi muộn") {
      resolvedStatus = "Đi muộn (có phép)";
    }
  }

  return prisma.attendanceRecord.create({
    data: {
      date: data.date,
      inTime: data.inTime,
      outTime: data.outTime || "-",
      status: resolvedStatus,
      fine: resolvedFine,
      halfDayDeduction,
      employeeId,
    },
  });
};

export const checkOutEmployeeService = async (employeeId: string) => {
  const { hour: vnHour, minute: vnMinute, isoDate: todayIsoVN, dateStr: todayStr, timeStr: outTime } = getVnDateTime();

  const todayRecord = await prisma.attendanceRecord.findFirst({
    where: { employeeId, date: todayStr },
  });

  if (!todayRecord) {
    throw new Error("Chưa check-in hôm nay!");
  }
  if (todayRecord.outTime && todayRecord.outTime !== "-") {
    throw new Error("Đã check-out rồi!");
  }

  const outMinutes = vnHour * 60 + vnMinute;
  const isEarlyLeave = outMinutes < CHECKOUT_HOUR * 60;
  const hasApprovedEarlyLeave = await hasApprovedLeaveTypeOnDate(employeeId, "Về sớm", todayIsoVN);
  
  const existingHalf = todayRecord.halfDayDeduction || 0;
  let halfDayDeduction = existingHalf;
  let additionalHalfDayApplied = false;

  let tags = new Set(todayRecord.status.split(" + ").map(s => s.trim()).filter(Boolean));

  if (isEarlyLeave) {
    if (hasApprovedEarlyLeave) {
      halfDayDeduction = existingHalf;
      tags.delete("Về sớm");
      tags.add("Về sớm (có phép)");
    } else {
      const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
      const unitHalf = Math.round((employee!.baseSalary || 0) / STANDARD_WORK_DAYS / 2);

      if (existingHalf === 0) {
        additionalHalfDayApplied = true;
        halfDayDeduction = unitHalf;
        const morningLeave = outMinutes <= HALF_DAY_SPLIT_MINUTES;
        
        if (morningLeave) {
          tags.add("Nửa ngày sáng");
          tags.delete("Đúng giờ");
        } else {
          tags.add("Về sớm");
          tags.delete("Đúng giờ");
        }
      } else {
        if (!tags.has("Nửa ngày sáng") && !tags.has("Về sớm")) {
          tags.add("Về sớm");
        }
      }
    }
  }

  const newStatus = Array.from(tags).join(" + ");

  await prisma.attendanceRecord.update({
    where: { id: todayRecord.id },
    data: { outTime, status: newStatus, halfDayDeduction },
  });

  return {
    isEarlyLeave,
    halfDayDeduction,
    outTime,
    additionalHalfDayApplied,
    hasLeaveApproval: hasApprovedEarlyLeave,
  };
};

export const addManualBonusService = async (employeeId: string, data: { customer: string; service: string; profit: number; note?: string }) => {
  return prisma.salesRecord.create({
    data: { employeeId, customer: data.customer, service: data.service, profit: Number(data.profit), note: data.note },
  });
};

export const deleteSalesRecordService = async (employeeId: string, salesRecordId: string) => {
  const existing = await prisma.salesRecord.findFirst({
    where: { id: salesRecordId, employeeId },
  });
  if (!existing) {
    throw new Error("Không tìm thấy khoản điều chỉnh.");
  }

  return prisma.salesRecord.delete({ where: { id: salesRecordId } });
};

export const waiveHalfDayDeductionService = async (employeeId: string, recordId: string) => {
  const record = await prisma.attendanceRecord.findFirst({
    where: { id: recordId, employeeId },
  });
  if (!record) {
    throw new Error("Không tìm thấy bản ghi chấm công.");
  }
  if ((record.halfDayDeduction || 0) <= 0) {
    throw new Error("Bản ghi không có khoản trừ nửa ngày.");
  }

  return prisma.attendanceRecord.update({
    where: { id: recordId },
    data: { halfDayDeduction: 0 },
  });
};

export const waiveAttendanceFineService = async (employeeId: string, recordId: string) => {
  const record = await prisma.attendanceRecord.findFirst({
    where: { id: recordId, employeeId },
  });
  if (!record) {
    throw new Error("Không tìm thấy bản ghi chấm công.");
  }
  if ((record.fine || 0) <= 0) {
    throw new Error("Bản ghi không có khoản phạt CI.");
  }

  return prisma.attendanceRecord.update({
    where: { id: recordId },
    data: { fine: 0 },
  });
};

export const excuseScheduledAbsenceService = async (employeeId: string, targetDate: string) => {
  if (!targetDate) {
    throw new Error("Thiếu ngày cần hoàn tác (date).");
  }

  const existing = await prisma.attendanceRecord.findFirst({
    where: { employeeId, date: targetDate },
  });

  const payload = {
    date: targetDate,
    inTime: "08:00",
    outTime: "-",
    status: "Có phép",
    fine: 0,
    halfDayDeduction: 0,
    employeeId,
  };

  if (existing) {
    return prisma.attendanceRecord.update({
      where: { id: existing.id },
      data: payload,
    });
  } else {
    return prisma.attendanceRecord.create({
      data: payload,
    });
  }
};

export const runPenalizeForgotCheckoutService = async (): Promise<{ penalized: number }> => {
  const { dateStr: todayStr } = getVnDateTime();

  const forgotRecords = await prisma.attendanceRecord.findMany({
    where: { date: todayStr, outTime: "-", halfDayDeduction: 0 },
    include: { employee: true },
  });

  if (forgotRecords.length === 0) return { penalized: 0 };

  await prisma.$transaction(async (tx) => {
    for (const record of forgotRecords) {
      const halfDayDeduction = Math.round(
        (record.employee.baseSalary || 0) / STANDARD_WORK_DAYS / 2,
      );

      await tx.attendanceRecord.update({
        where: { id: record.id },
        data: { outTime: "Quên checkout", status: "Quên checkout", halfDayDeduction },
      });
    }
  });

  return { penalized: forgotRecords.length };
};
