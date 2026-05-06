import { STANDARD_WORK_DAYS, HALF_DAY_SPLIT_MINUTES } from "../constants/index.js";
import { attendanceDateBelongsToPayrollMonth } from "../utils/payrollDates.js";
import {
  formatDdMmYyyy,
  isPaidPublicHolidayDdMmYyyy,
  normalizeDdMmYyyy,
} from "./vietnamPaidHolidays.js";

export type AttendancePayrollRow = {
  date: string;
  inTime?: string;
  outTime?: string;
  status: string;
  fine?: number;
  halfDayDeduction?: number;
};

/** Đơn giá 1 ngày lương theo lương cơ bản gộp (không dùng lương BH). */
export const dailyWageFromGrossBase = (grossBaseSalary: number): number =>
  Math.round((grossBaseSalary || 0) / STANDARD_WORK_DAYS);

export const LATE_FINE_UNIT_VND = 50_000;

export function isLateAttendanceStatus(status: string): boolean {
  const s = String(status || "");
  if (/Nửa ngày chiều/i.test(s)) return false;
  return /Đi muộn/i.test(s);
}

export function hasValidCheckIn(r: AttendancePayrollRow): boolean {
  const inT = r.inTime != null ? String(r.inTime).trim() : "";
  return !!inT && inT !== "-";
}

/** Ngày hôm nay theo Asia/Ho_Chi_Minh (dùng cho cutoff vắng mặt kỳ đang chạy). */
export function getTodayPartsVN(): { year: number; month: number; day: number } {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(new Date());
  let y = 0,
    m = 0,
    d = 0;
  for (const p of parts) {
    if (p.type === "year") y = parseInt(p.value, 10);
    if (p.type === "month") m = parseInt(p.value, 10);
    if (p.type === "day") d = parseInt(p.value, 10);
  }
  return { year: y, month: m, day: d };
}

export function resolveAbsenceCutoffDay(
  payrollMonth: number,
  payrollYear: number,
  todayVN: { year: number; month: number; day: number } = getTodayPartsVN(),
): number {
  const lastDom = new Date(payrollYear, payrollMonth, 0).getDate();
  if (todayVN.year !== payrollYear || todayVN.month !== payrollMonth) {
    return lastDom;
  }
  return Math.min(todayVN.day, lastDom);
}

/** Các ngày T2–T6 trong tháng tới cutoff, không tính ngày lễ hưởng lương. */
export function listScheduledWorkDatesInMonth(
  payrollMonth: number,
  payrollYear: number,
  cutoffDayInclusive: number,
): string[] {
  const lastDom = new Date(payrollYear, payrollMonth, 0).getDate();
  const cap = Math.min(Math.max(cutoffDayInclusive, 0), lastDom);
  const out: string[] = [];
  for (let day = 1; day <= cap; day++) {
    const dt = new Date(payrollYear, payrollMonth - 1, day);
    const dow = dt.getDay();
    if (dow === 0 || dow === 6) continue;
    const ddmmyyyy = formatDdMmYyyy(day, payrollMonth, payrollYear);
    if (isPaidPublicHolidayDdMmYyyy(ddmmyyyy)) continue;
    out.push(ddmmyyyy);
  }
  return out;
}

/** Ngày làm việc có check-in hợp lệ (theo bản ghi trong kỳ). */
export function buildPresentDateSet(
  records: AttendancePayrollRow[],
  payrollMonth: number,
  payrollYear: number,
): Set<string> {
  const present = new Set<string>();
  for (const r of records) {
    if (!attendanceDateBelongsToPayrollMonth(r.date, payrollMonth, payrollYear)) continue;
    if (!hasValidCheckIn(r)) continue;
    const norm = normalizeDdMmYyyy(r.date);
    if (norm) present.add(norm);
  }
  return present;
}

export function computeAbsentScheduledDates(
  records: AttendancePayrollRow[],
  payrollMonth: number,
  payrollYear: number,
  cutoffDayInclusive: number,
): string[] {
  const scheduled = listScheduledWorkDatesInMonth(
    payrollMonth,
    payrollYear,
    cutoffDayInclusive,
  );
  const present = buildPresentDateSet(records, payrollMonth, payrollYear);
  return scheduled.filter((d) => !present.has(d));
}

export function computeScheduledAbsentDeductionVnd(
  records: AttendancePayrollRow[],
  grossBaseSalary: number,
  payrollMonth: number,
  payrollYear: number,
  cutoffDayInclusive: number,
): { absentDays: number; deductionVnd: number; absentDates: string[] } {
  const absentDates = computeAbsentScheduledDates(
    records,
    payrollMonth,
    payrollYear,
    cutoffDayInclusive,
  );
  const daily = dailyWageFromGrossBase(grossBaseSalary);
  return {
    absentDays: absentDates.length,
    deductionVnd: absentDates.length * daily,
    absentDates,
  };
}

/**
 * Phạt đi trễ trong tháng: lần thứ k trong tháng = k × 50_000 (reset đầu tháng).
 * Xếp theo ngày và giờ vào.
 */
export function computeLatePenaltyTotalVnd(
  records: AttendancePayrollRow[],
  payrollMonth: number,
  payrollYear: number,
): number {
  const sorted = sortLateRecordsForMonth(records, payrollMonth, payrollYear);
  let total = 0;
  for (let i = 0; i < sorted.length; i++) {
    total += (i + 1) * LATE_FINE_UNIT_VND;
  }
  return total;
}

/** Chi tiết từng lần đi trễ trong tháng (tiền phạt của lần đó = thứ tự × 50k). */
export function buildLateFineDetailRows(
  records: AttendancePayrollRow[],
  payrollMonth: number,
  payrollYear: number,
): { date: string; amount: number; status: string }[] {
  const sorted = sortLateRecordsForMonth(records, payrollMonth, payrollYear);
  return sorted.map((r, i) => ({
    date: r.date,
    amount: (i + 1) * LATE_FINE_UNIT_VND,
    status: r.status,
  }));
}

function sortLateRecordsForMonth(
  records: AttendancePayrollRow[],
  payrollMonth: number,
  payrollYear: number,
): AttendancePayrollRow[] {
  const lateRows = records.filter(
    (r) =>
      attendanceDateBelongsToPayrollMonth(r.date, payrollMonth, payrollYear) &&
      isLateAttendanceStatus(r.status) &&
      hasValidCheckIn(r) &&
      !isAfternoonOnlyCheckIn(r.inTime),
  );

  const withSortKey = lateRows.map((r) => {
    const norm = normalizeDdMmYyyy(r.date) || r.date;
    const time = parseAttendanceInMinutes(r.inTime);
    return { r, norm, time };
  });
  withSortKey.sort((a, b) => {
    const ca = a.norm.localeCompare(b.norm);
    if (ca !== 0) return ca;
    return a.time - b.time;
  });
  return withSortKey.map((x) => x.r);
}

/** Parse giờ vào dạng chuỗi chấm công (vd 08:30, 8:30 SA) → phút từ 0h. */
export function parseAttendanceInMinutes(inTime?: string): number {
  const s = String(inTime || "").trim();
  const m = s.match(/(\d{1,2})\s*:\s*(\d{2})/);
  if (!m) return -1;
  const h = parseInt(m[1], 10) % 24;
  const min = parseInt(m[2], 10);
  if (Number.isNaN(h) || Number.isNaN(min)) return -1;
  return h * 60 + min;
}

/** Chỉ buổi chiều: vào làm sau 12h trưa — trừ nửa ngày, không tính vào thang phạt đi trễ. */
export function isAfternoonOnlyCheckIn(inTime?: string): boolean {
  const mins = parseAttendanceInMinutes(inTime);
  if (mins < 0) return false;
  return mins > HALF_DAY_SPLIT_MINUTES;
}

/** Ngày làm đủ điều kiện (có check-in, không tính là vắng cả ngày kiểu legacy). */
export function listAttendedWorkDatesForPayroll(
  records: AttendancePayrollRow[],
  payrollMonth: number,
  payrollYear: number,
  cutoffDayInclusive: number,
): string[] {
  const scheduled = new Set(
    listScheduledWorkDatesInMonth(payrollMonth, payrollYear, cutoffDayInclusive),
  );
  const present = buildPresentDateSet(records, payrollMonth, payrollYear);
  const attended = [...scheduled].filter((d) => present.has(d));
  attended.sort((a, b) => a.localeCompare(b));
  return attended;
}
