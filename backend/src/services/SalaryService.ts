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
  /** Thưởng khác, kể cả bản ghi cũ service "Thưởng" (legacy). */
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

/**
 * Ngày công đi làm: có chấm công vào (inTime) và không phải vắng cả ngày không phép.
 * Không bắt buộc phải checkout — nhiều phiếu lương bị 0 ngày vì outTime vẫn "-" hoặc "Quên checkout".
 * Không có lịch nghỉ lễ cố định: ngày không có bản ghi hoặc không check-in không tính vào ngày công.
 */
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
  profit: number;
  service: string | null;
  createdAt: Date;
}

/** Calculates the employee's social/health/unemployment insurance contributions. */
export const calcInsurance = (insuranceSalary: number) => ({
  bhxhNld: Math.round(insuranceSalary * BHXH_NLD_RATE),
  bhytNld: Math.round(insuranceSalary * BHYT_NLD_RATE),
  bhtnNld: Math.round(insuranceSalary * BHTN_NLD_RATE)
});

/**
 * Derives the insurance base salary and fixed allowances from gross base salary.
 * Employees earning above SALARY_THRESHOLD have 2M deducted before insurance is applied,
 * and also receive attendance/lunch/other allowances.
 */
export const calcBaseComponents = (baseSalary: number) => {
  const insuranceSalary = baseSalary >= SALARY_THRESHOLD
    ? baseSalary - 2_000_000
    : baseSalary;
  const chuyenCan = baseSalary >= SALARY_THRESHOLD ? BONUS_CHUYÊN_CẦN : 0;
  const anTrua    = baseSalary >= SALARY_THRESHOLD ? BONUS_ĂN_TRƯA    : 0;
  const hoTroKhac = baseSalary >= SALARY_THRESHOLD ? BONUS_HỖ_TRỢ_KHÁC : 0;
  return { insuranceSalary, chuyenCan, anTrua, hoTroKhac };
};

/**
 * Gross contract salary used for attendance/lunch/other fixed allowances when rebuilding from SalaryHistory.
 * Legacy rows only stored insurance base in `baseSalary`; infer gross when the snapshot clearly crossed the threshold.
 */
export function grossSalaryForLockedPayrollAllowances(snapshot: {
  grossBaseSalary?: number | null;
  baseSalary: number;
  /** Helps resolve ambiguous legacy rows where baseSalary is exactly 6M (either gross 6M or gross 8M → insurance 6M). */
  totalBonus?: number;
  hoaHong?: number;
  thuongKhac?: number;
}): number {
  const stored = snapshot.grossBaseSalary;
  if (stored != null && Number.isFinite(stored) && stored > 0) return stored;
  const ins = snapshot.baseSalary;
  if (ins >= SALARY_THRESHOLD) return ins + 2_000_000;

  const fixedSum =
    BONUS_CHUYÊN_CẦN + BONUS_ĂN_TRƯA + BONUS_HỖ_TRỢ_KHÁC;
  const tb = snapshot.totalBonus ?? 0;
  const hh = snapshot.hoaHong ?? 0;
  const tk = snapshot.thuongKhac ?? 0;
  const fixedPortion = tb - hh - tk;
  if (Math.abs(fixedPortion - fixedSum) < 1) return ins + 2_000_000;

  return ins;
}

const PHU_CAP_SERVICES = new Set(["Chuyên cần", "Ăn trưa", "Hỗ trợ khác"]);

/** Ghi nhận sales thủ công; CRM/doanh số và "Thưởng hoa hồng" → hoaHong; "Thưởng khác"/"Thưởng" → thuongKhac. */
export const calcSalesBreakdown = (salesRecords: SalesRecord[]) => {
  let hoaHong = 0, thuongKhac = 0, manualFines = 0, tamUng = 0;
  for (const r of salesRecords) {
    const amount = Number(r.profit) || 0;
    const svc = r.service || "";
    if (svc === "Phạt") manualFines += Math.abs(amount);
    else if (svc === "Tạm ứng") tamUng += Math.abs(amount);
    else if (PHU_CAP_SERVICES.has(svc)) {
      /* phụ cấp lưu dạng sales — không cộng vào hoa hồng/ thưởng biến đổi */
    } else if (svc === "Thưởng khác" || svc === "Thưởng") thuongKhac += amount;
    else if (svc === "Thưởng hoa hồng") hoaHong += amount;
    else hoaHong += amount;
  }
  return { hoaHong, thuongKhac, manualFines, tamUng };
};

/**
 * Aggregates attendance-based deductions for one payroll month:
 * - Vắng theo lịch T2–T6 (trừ ngày lễ hưởng lương): không có check-in hợp lệ ⇒ trừ 1 ngày lương (= lương cơ bản / 22).
 * - Đi trễ: tổng phạt = Σ (thứ tự lần trong tháng × 50k).
 * - Nửa ngày / quên checkout: giữ theo trường halfDayDeduction trên bản ghi.
 */
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

/** Computes the full salary breakdown from raw attendance and sales data. */
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
