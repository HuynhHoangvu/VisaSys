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
  outTime: string;
  status: string;
  fine: number;
  halfDayDeduction: number;
}

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

/** Splits sales records into commission, manual fines, and salary advances. */
export const calcSalesBreakdown = (salesRecords: SalesRecord[]) => {
  let hoaHong = 0, manualFines = 0, tamUng = 0;
  for (const r of salesRecords) {
    const amount = Number(r.profit) || 0;
    if (r.service === "Phạt") manualFines += Math.abs(amount);
    else if (r.service === "Tạm ứng") tamUng += Math.abs(amount);
    else if (!["Chuyên cần", "Ăn trưa", "Hỗ trợ khác"].includes(r.service || ""))
      hoaHong += amount;
  }
  return { hoaHong, manualFines, tamUng };
};

/**
 * Aggregates attendance-based deductions and counts actual worked days.
 * A day counts as "worked" only if the employee checked out normally
 * (i.e., outTime exists and is not a placeholder or forgot-checkout marker).
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

  const checkedOut = attendanceRecords.filter(
    r => r.outTime && r.outTime !== "-" && r.outTime !== "Quên checkout"
  );
  const workDays  = checkedOut.length;
  const workDates = checkedOut.map(r => r.date).sort();

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
  const { hoaHong, manualFines, tamUng } = calcSalesBreakdown(salesRecords);
  const { attendanceFines, halfDayDeduction, fullDayAbsenceDeduction, workDays, workDates } =
    calcAttendanceBreakdown(attendanceRecords, insuranceSalary);

  const totalIncome     = insuranceSalary + chuyenCan + anTrua + hoTroKhac + hoaHong;
  const totalDeductions = tamUng + manualFines + attendanceFines + halfDayDeduction + fullDayAbsenceDeduction + bhxhNld + bhytNld + bhtnNld;
  const finalSalary     = totalIncome - totalDeductions;

  return {
    insuranceSalary, chuyenCan, anTrua, hoTroKhac,
    hoaHong, manualFines, tamUng,
    attendanceFines, halfDayDeduction, fullDayAbsenceDeduction,
    bhxhNld, bhytNld, bhtnNld,
    workDays, workDates,
    finalSalary
  };
};
