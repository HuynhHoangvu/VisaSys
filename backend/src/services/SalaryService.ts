import {
  SALARY_THRESHOLD,
  BHXH_NLD_RATE, BHYT_NLD_RATE, BHTN_NLD_RATE,
  BONUS_CHUYÊN_CẦN, BONUS_ĂN_TRƯA, BONUS_HỖ_TRỢ_KHÁC
} from "../constants/index.js";

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

interface AttendanceRecord {
  date: string;
  inTime?: string;
  outTime: string;
  status: string;
  fine: number;
  halfDayDeduction: number;
}

/**
 * Ngày công đi làm: có chấm công vào (inTime) và không phải vắng cả ngày không phép.
 * Không bắt buộc phải checkout — nhiều phiếu lương bị 0 ngày vì outTime vẫn "-" hoặc "Quên checkout".
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
 * Aggregates attendance-based deductions and counts worked days (có check-in, không vắng không phép).
 */
export const calcAttendanceBreakdown = (
  attendanceRecords: AttendanceRecord[],
  insuranceSalary: number
) => {
  const attendanceFines = attendanceRecords.reduce((s, r) => s + (r.fine || 0), 0);
  const halfDayDeduction = attendanceRecords.reduce((s, r) => s + (r.halfDayDeduction || 0), 0);
  const fullDayAbsenceDeduction = attendanceRecords.reduce((s, r) =>
    r.status === "Vắng không phép" ? s + Math.round(insuranceSalary / 21) : s
  , 0);

  const workDates = getWorkDatesFromAttendance(attendanceRecords);
  const workDays = workDates.length;

  return { attendanceFines, halfDayDeduction, fullDayAbsenceDeduction, workDays, workDates };
};

/** Computes the full salary breakdown from raw attendance and sales data. */
export const calcFullSalary = (
  baseSalary: number,
  attendanceRecords: AttendanceRecord[],
  salesRecords: SalesRecord[]
): SalaryBreakdown => {
  const { insuranceSalary, chuyenCan, anTrua, hoTroKhac } = calcBaseComponents(baseSalary);
  const { bhxhNld, bhytNld, bhtnNld } = calcInsurance(insuranceSalary);
  const { hoaHong, thuongKhac, manualFines, tamUng } = calcSalesBreakdown(salesRecords);
  const { attendanceFines, halfDayDeduction, fullDayAbsenceDeduction, workDays, workDates } =
    calcAttendanceBreakdown(attendanceRecords, insuranceSalary);

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
