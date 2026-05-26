import { prisma } from "../../lib/prisma.js";
import {
  SALARY_THRESHOLD,
  BHXH_NLD_RATE, BHYT_NLD_RATE, BHTN_NLD_RATE,
  BONUS_CHUYÊN_CẦN, BONUS_ĂN_TRƯA, BONUS_HỖ_TRỢ_KHÁC
} from "../constants/index.js";
import {
  computeLatePenaltyTotalVnd,
  computeScheduledAbsentDeductionVnd,
  listAttendedWorkDatesForPayroll,
  type AttendancePayrollRow,
} from "./attendancePayroll.js";

export interface SalaryBreakdown {
  insuranceSalary: number;
  chuyenCan: number;
  anTrua: number;
  hoTroKhac: number;
  hoaHong: number;
  thuongKhac: number;
  manualFines: number;
  tamUng: number;
  attendanceFines: number;
  halfDayDeduction: number;
  fullDayAbsenceDeduction: number;
  bhxhNld: number;
  bhytNld: number;
  bhtnNld: number;
  workDays: number;
  workDates: string[];
  finalSalary: number;
}

interface AttendanceRecord extends AttendancePayrollRow {
  date: string;
  outTime: string;
  status: string;
  fine: number;
  halfDayDeduction: number;
}

export { attendanceDateBelongsToPayrollMonth } from "../utils/payrollDates.js";
import { attendanceDateBelongsToPayrollMonth } from "../utils/payrollDates.js";
import { isSaleManager } from "./accessResolution.js";
import { dedupeSalaryHistoryLatestPerEmployeeMonth } from "../utils/salaryHistoryDedupe.js";

export const getWorkDatesFromAttendance = (attendanceRecords: AttendanceRecord[]): string[] => {
  const byDay = new Map<string, true>();
  for (const r of attendanceRecords) {
    if (r.status === "Vắng không phép") continue;
    const inT = r.inTime != null ? String(r.inTime).trim() : "";
    if (!inT || inT === "-") continue;
    byDay.set(r.date, true);
  }
  return Array.from(byDay.keys()).sort();
};

interface SalesRecord {
  id: string;
  profit: number;
  service: string | null;
  createdAt: Date;
}

export const calcInsurance = (insuranceSalary: number) => ({
  bhxhNld: Math.round(insuranceSalary * BHXH_NLD_RATE),
  bhytNld: Math.round(insuranceSalary * BHYT_NLD_RATE),
  bhtnNld: Math.round(insuranceSalary * BHTN_NLD_RATE)
});

export const calcBaseComponents = (baseSalary: number) => {
  const insuranceSalary = baseSalary >= SALARY_THRESHOLD
    ? baseSalary - 2_000_000
    : baseSalary;
  const chuyenCan = baseSalary >= SALARY_THRESHOLD ? BONUS_CHUYÊN_CẦN : 0;
  const anTrua    = baseSalary >= SALARY_THRESHOLD ? BONUS_ĂN_TRƯA    : 0;
  const hoTroKhac = baseSalary >= SALARY_THRESHOLD ? BONUS_HỖ_TRỢ_KHÁC : 0;
  return { insuranceSalary, chuyenCan, anTrua, hoTroKhac };
};

export function grossSalaryForLockedPayrollAllowances(snapshot: {
  baseSalary: number;
  totalBonus?: number;
  hoaHong?: number;
  thuongKhac?: number;
}): number {
  const ins = snapshot.baseSalary;
  if (ins >= SALARY_THRESHOLD) return ins + 2_000_000;

  const fixedSum = BONUS_CHUYÊN_CẦN + BONUS_ĂN_TRƯA + BONUS_HỖ_TRỢ_KHÁC;
  const tb = snapshot.totalBonus ?? 0;
  const hh = snapshot.hoaHong ?? 0;
  const tk = snapshot.thuongKhac ?? 0;
  const fixedPortion = tb - hh - tk;
  if (Math.abs(fixedPortion - fixedSum) < 1) return ins + 2_000_000;

  return ins;
}

const PHU_CAP_SERVICES = new Set(["Chuyên cần", "Ăn trưa", "Hỗ trợ khác"]);

export const calcSalesBreakdown = (salesRecords: SalesRecord[]) => {
  let hoaHong = 0, thuongKhac = 0, manualFines = 0, tamUng = 0;
  for (const r of salesRecords) {
    const amount = Number(r.profit) || 0;
    const svc = r.service || "";
    if (svc === "Phạt") manualFines += Math.abs(amount);
    else if (svc === "Tạm ứng") tamUng += Math.abs(amount);
    else if (PHU_CAP_SERVICES.has(svc)) { }
    else if (svc === "Thưởng khác" || svc === "Thưởng") thuongKhac += amount;
    else if (svc === "Thưởng hoa hồng") hoaHong += amount;
    else hoaHong += amount;
  }
  return { hoaHong, thuongKhac, manualFines, tamUng };
};

export const calcAttendanceBreakdown = (
  attendanceRecords: AttendanceRecord[],
  grossBaseSalary: number,
  payrollMonth: number,
  payrollYear: number,
  absenceCutoffDay?: number,
) => {
  const lastDom = new Date(payrollYear, payrollMonth, 0).getDate();
  const cutoff = absenceCutoffDay ?? lastDom;

  const attendanceFines = computeLatePenaltyTotalVnd(
    attendanceRecords,
    payrollMonth,
    payrollYear,
  );
  const halfDayDeduction = attendanceRecords.reduce((s, r) => s + (r.halfDayDeduction || 0), 0);

  const { deductionVnd: fullDayAbsenceDeduction, absentDates } =
    computeScheduledAbsentDeductionVnd(
      attendanceRecords,
      grossBaseSalary,
      payrollMonth,
      payrollYear,
      cutoff,
    );

  const workDates = listAttendedWorkDatesForPayroll(
    attendanceRecords,
    payrollMonth,
    payrollYear,
    cutoff,
  );
  const workDays = workDates.length;

  return {
    attendanceFines,
    halfDayDeduction,
    fullDayAbsenceDeduction,
    workDays,
    workDates,
    absentDates,
  };
};

export const calcFullSalary = (
  baseSalary: number,
  attendanceRecords: AttendanceRecord[],
  salesRecords: SalesRecord[],
  payrollMonth: number,
  payrollYear: number,
  absenceCutoffDay?: number,
): SalaryBreakdown => {
  const { insuranceSalary, chuyenCan, anTrua, hoTroKhac } = calcBaseComponents(baseSalary);
  const { bhxhNld, bhytNld, bhtnNld } = calcInsurance(insuranceSalary);
  const { hoaHong, thuongKhac, manualFines, tamUng } = calcSalesBreakdown(salesRecords);
  const { attendanceFines, halfDayDeduction, fullDayAbsenceDeduction, workDays, workDates } =
    calcAttendanceBreakdown(
      attendanceRecords,
      baseSalary,
      payrollMonth,
      payrollYear,
      absenceCutoffDay,
    );

  const totalIncome     = insuranceSalary + chuyenCan + anTrua + hoTroKhac + hoaHong + thuongKhac;
  const totalDeductions = tamUng + manualFines + attendanceFines + halfDayDeduction + fullDayAbsenceDeduction + bhxhNld + bhytNld + bhtnNld;
  const finalSalary     = totalIncome - totalDeductions;

  return {
    insuranceSalary, chuyenCan, anTrua, hoTroKhac,
    hoaHong, thuongKhac, manualFines, tamUng,
    attendanceFines, halfDayDeduction, fullDayAbsenceDeduction,
    bhxhNld, bhytNld, bhtnNld,
    workDays, workDates,
    finalSalary
  };
};

export const finalizeMonthSalaryService = async (monthYear: string) => {
  if (!monthYear) throw new Error("Vui lòng cung cấp tháng chốt lương!");

  const [mmStr, yyyyStr] = monthYear.split("/");
  const mm   = parseInt(mmStr);
  const yyyy = parseInt(yyyyStr);

  const monthStart = new Date(yyyy, mm - 1, 1);
  const monthEnd   = new Date(yyyy, mm, 1);

  const employees = await prisma.employee.findMany({
    include: {
      attendanceRecords: {
        where: {
          OR: [
            { date: { contains: `/${String(mm).padStart(2, "0")}/${yyyy}` } },
            { date: { contains: `/${mm}/${yyyy}` } },
          ],
        },
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
      const monthAtt = emp.attendanceRecords.filter((r) =>
        attendanceDateBelongsToPayrollMonth(r.date, mm, yyyy),
      ) as any;
      const monthSales = emp.salesRecords as any;

      monthAtt.forEach((r: any) => attIdsToDelete.push(r.id));
      monthSales.forEach((r: any) => saleIdsToDelete.push(r.id));

      const {
        hoaHong: newHoaHong,
        thuongKhac: newThuongKhac,
        tamUng: newTamUng,
        manualFines: newManualFines,
      } = calcSalesBreakdown(monthSales);

      const totalSalaryBrutto = emp.baseSalary || 0;
      const ins = totalSalaryBrutto >= SALARY_THRESHOLD ? totalSalaryBrutto - 2_000_000 : totalSalaryBrutto;

      const lastDom = new Date(yyyy, mm, 0).getDate();
      const attBreakdown = calcAttendanceBreakdown(
        monthAtt,
        totalSalaryBrutto,
        mm,
        yyyy,
        lastDom,
      );
      const newAttendanceFines = attBreakdown.attendanceFines;
      const newHalfDay         = attBreakdown.halfDayDeduction;
      const newFullDay         = attBreakdown.fullDayAbsenceDeduction;
      const newWorkDates       = attBreakdown.workDates;

      const existing = await tx.salaryHistory.findUnique({
        where: { employeeId_monthYear: { employeeId: emp.id, monthYear } },
      });

      const finalHoaHong         = (existing?.hoaHong || 0) + newHoaHong;
      const finalThuongKhac      = (existing?.thuongKhac || 0) + newThuongKhac;
      const finalTamUng          = (existing?.tamUng || 0) + newTamUng;
      const finalManualFines     = (existing?.manualFines || 0) + newManualFines;
      const finalAttendanceFines = (existing?.attendanceFines || 0) + newAttendanceFines;
      const finalHalfDay         = (existing?.halfDayDeduction || 0) + newHalfDay;
      const finalFullDay         = (existing?.fullDayAbsenceDeduction || 0) + newFullDay;

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
      const finalSalary     = ins + cc + at + htk + finalHoaHong + finalThuongKhac - finalTamUng - totalDeductions;

      const historyData = {
        baseSalary:              ins,
        totalBonus:              cc + at + htk + finalHoaHong + finalThuongKhac,
        totalDeduction:          totalDeductions + finalTamUng,
        finalSalary,
        hoaHong:                 finalHoaHong,
        thuongKhac:              finalThuongKhac,
        tamUng:                  finalTamUng,
        manualFines:             finalManualFines,
        attendanceFines:         finalAttendanceFines,
        halfDayDeduction:        finalHalfDay,
        fullDayAbsenceDeduction: finalFullDay,
        workDays:                finalWorkDays,
        workDates:               finalWorkDates,
      };

      await tx.salaryHistory.upsert({
        where: { employeeId_monthYear: { employeeId: emp.id, monthYear } },
        create: { ...historyData, monthYear, employeeId: emp.id },
        update: historyData,
      });
    }

    if (attIdsToDelete.length > 0)  await tx.attendanceRecord.deleteMany({ where: { id: { in: attIdsToDelete } } });
    if (saleIdsToDelete.length > 0) await tx.salesRecord.deleteMany({ where: { id: { in: saleIdsToDelete } } });
  });
};

export const getSalaryHistoryService = async (user: any) => {
  let whereClause: Record<string, any> = {};
  
  if (user && user.department === "Sale") {
    if (isSaleManager(user)) {
      whereClause = { employee: { department: { name: "Sale" } } };
    } else {
      whereClause = { employeeId: user.id };
    }
  }

  const rows = await prisma.salaryHistory.findMany({
    where: whereClause,
    include: {
      employee: { select: { id: true, name: true, employeeCode: true, department: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  const deduped = dedupeSalaryHistoryLatestPerEmployeeMonth(rows);
  deduped.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return deduped;
};
