/**
 * Chuẩn hoá ngày chấm công dạng DD/MM/YYYY (vi-VN). Dùng khi chốt lương để chỉ xử lý đúng tháng năm
 * (tránh xóa nhầm bản ghi tháng khác nếu filter chỉ dùng contains).
 */
export const attendanceDateBelongsToPayrollMonth = (
  dateStr: string,
  payrollMonth: number,
  payrollYear: number,
): boolean => {
  const parts = String(dateStr || "").split("/");
  if (parts.length !== 3) return false;
  const d = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const y = parseInt(parts[2], 10);
  if ([d, m, y].some((n) => Number.isNaN(n))) return false;
  return m === payrollMonth && y === payrollYear;
};
