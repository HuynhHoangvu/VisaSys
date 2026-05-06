/**
 * Ngày nghỉ lễ được hưởng nguyên lương (không trừ công vắng theo lịch làm việc T2–T6).
 * Phần cố định theo dương lịch + bổ sung theo thông báo năm (Tết, Giỗ Tổ, ngày nghỉ nối Quốc khánh…).
 * Cập nhật VARIABLE_PUBLIC_HOLIDAYS khi có thông báo mới của Bộ Nội vụ.
 */

const pad = (n: number) => String(n).padStart(2, "0");

/** dd/mm/yyyy (đồng bộ với chuỗi ngày chấm công vi-VN có padding). */
export const formatDdMmYyyy = (d: number, m: number, y: number): string =>
  `${pad(d)}/${pad(m)}/${y}`;

/**
 * Ngày lễ biến đổi theo năm (Tết, Giỗ Tổ Hùng Vương, ngày nghỉ nối Quốc khánh…).
 * Giữ nguyên định dạng dd/mm/yyyy.
 */
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

/** Chuẩn hoá key dd/mm/yyyy để so khớp bản ghi có thể không pad (vd 6/5/2026). */
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

export function isPaidPublicHolidayDdMmYyyy(dateStr: string): boolean {
  const norm = normalizeDdMmYyyy(dateStr);
  if (!norm) return false;
  const y = parseInt(norm.split("/")[2], 10);
  return paidHolidayDatesForYear(y).has(norm);
}
