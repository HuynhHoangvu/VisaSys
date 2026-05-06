/**
 * Đồng bộ logic chấm công/tháng với backend/src/services/attendancePayroll.ts (preview UI).
 * Khi đổi quy tắc nên cập nhật cả hai nơi.
 */

import type { AttendanceRecord } from "../types";

export const STANDARD_WORK_DAYS = 22;
export const LATE_FINE_UNIT_VND = 50_000;
/** Đồng bộ backend/src/constants HALF_DAY_SPLIT_MINUTES */
export const HALF_DAY_SPLIT_MINUTES = 12 * 60;

const pad = (n: number) => String(n).padStart(2, "0");

export const formatDdMmYyyy = (d: number, m: number, y: number): string =>
  `${pad(d)}/${pad(m)}/${y}`;

export const VARIABLE_PUBLIC_HOLIDAYS: Record<number, readonly string[]> = {
  2025: [
    "26/01/2025",
    "27/01/2025",
    "28/01/2025",
    "29/01/2025",
    "30/01/2025",
    "07/04/2025",
    "01/09/2025",
  ],
  2026: [
    "16/02/2026",
    "17/02/2026",
    "18/02/2026",
    "19/02/2026",
    "20/02/2026",
    "26/04/2026",
    "01/09/2026",
  ],
};

export function normalizeDdMmYyyy(raw: string): string | null {
  const parts = String(raw || "")
    .trim()
    .split("/")
    .map((p) => p.trim());
  if (parts.length !== 3) return null;
  const d = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const y = parseInt(parts[2], 10);
  if ([d, m, y].some((n) => Number.isNaN(n))) return null;
  return formatDdMmYyyy(d, m, y);
}

export function paidHolidayDatesForYear(year: number): Set<string> {
  const set = new Set<string>();
  set.add(formatDdMmYyyy(1, 1, year));
  set.add(formatDdMmYyyy(30, 4, year));
  set.add(formatDdMmYyyy(1, 5, year));
  set.add(formatDdMmYyyy(2, 9, year));
  const extra = VARIABLE_PUBLIC_HOLIDAYS[year];
  if (extra) for (const d of extra) set.add(d);
  return set;
}

export function isPaidPublicHolidayDdMmYyyy(dateStr: string): boolean {
  const norm = normalizeDdMmYyyy(dateStr);
  if (!norm) return false;
  const y = parseInt(norm.split("/")[2], 10);
  return paidHolidayDatesForYear(y).has(norm);
}

export function attendanceDateBelongsToPayrollMonth(
  dateStr: string,
  payrollMonth: number,
  payrollYear: number,
): boolean {
  const parts = String(dateStr || "").split("/");
  if (parts.length !== 3) return false;
  const m = parseInt(parts[1], 10);
  const y = parseInt(parts[2], 10);
  if ([m, y].some((n) => Number.isNaN(n))) return false;
  return m === payrollMonth && y === payrollYear;
}

export function getTodayPartsVN(asOf: Date = new Date()): {
  year: number;
  month: number;
  day: number;
} {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(asOf);
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

/** Phút trong ngày theo giờ VN (0–1439), dùng khi check-in/check-out. */
export function getVNWallClockMinutes(asOf: Date = new Date()): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  });
  const parts = formatter.formatToParts(asOf);
  let h = 0,
    min = 0;
  for (const p of parts) {
    if (p.type === "hour") h = parseInt(p.value, 10) % 24;
    if (p.type === "minute") min = parseInt(p.value, 10);
  }
  return h * 60 + min;
}

export function resolveAbsenceCutoffDay(
  payrollMonth: number,
  payrollYear: number,
  todayVN = getTodayPartsVN(),
): number {
  const lastDom = new Date(payrollYear, payrollMonth, 0).getDate();
  if (todayVN.year !== payrollYear || todayVN.month !== payrollMonth) {
    return lastDom;
  }
  return Math.min(todayVN.day, lastDom);
}

export function dailyWageFromGrossBase(grossBaseSalary: number): number {
  return Math.round((grossBaseSalary || 0) / STANDARD_WORK_DAYS);
}

export function hasValidCheckIn(r: Pick<AttendanceRecord, "inTime">): boolean {
  const inT = r.inTime != null ? String(r.inTime).trim() : "";
  return !!inT && inT !== "-";
}

export function isLateAttendanceStatus(status: string): boolean {
  const s = String(status || "");
  if (/Nửa ngày chiều/i.test(s)) return false;
  return /Đi muộn/i.test(s);
}

export function parseAttendanceInMinutes(inTime?: string): number {
  const s = String(inTime || "").trim();
  const m = s.match(/(\d{1,2})\s*:\s*(\d{2})/);
  if (!m) return -1;
  const h = parseInt(m[1], 10) % 24;
  const min = parseInt(m[2], 10);
  if (Number.isNaN(h) || Number.isNaN(min)) return -1;
  return h * 60 + min;
}

export function isAfternoonOnlyCheckIn(inTime?: string): boolean {
  const mins = parseAttendanceInMinutes(inTime);
  if (mins < 0) return false;
  return mins > HALF_DAY_SPLIT_MINUTES;
}

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

export function buildPresentDateSet(
  records: AttendanceRecord[],
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
  records: AttendanceRecord[],
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
  records: AttendanceRecord[],
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

/** Tiền phạt cho lần đi muộn tiếp theo trong tháng hiện tại (VN). */
export function calculateLateFineForNextCheckIn(
  attendanceRecords: AttendanceRecord[],
  asOf: Date = new Date(),
): number {
  if (getVNWallClockMinutes(asOf) > HALF_DAY_SPLIT_MINUTES) {
    return 0;
  }
  const { month, year } = getTodayPartsVN(asOf);
  const prior = attendanceRecords.filter(
    (r) =>
      attendanceDateBelongsToPayrollMonth(r.date, month, year) &&
      isLateAttendanceStatus(r.status) &&
      !isAfternoonOnlyCheckIn(r.inTime),
  );
  return (prior.length + 1) * LATE_FINE_UNIT_VND;
}

function sortLateRecordsForMonth(
  records: AttendanceRecord[],
  payrollMonth: number,
  payrollYear: number,
): AttendanceRecord[] {
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

export function computeLatePenaltyTotalVnd(
  records: AttendanceRecord[],
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

export function buildLateFineDetailRows(
  records: AttendanceRecord[],
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
