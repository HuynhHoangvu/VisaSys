/**
 * Giữ một bản ghi lương mới nhất cho mỗi cặp (employeeId, monthYear).
 * Tránh hiển thị trùng khi DB từng tạo nhiều dòng cho cùng một kỳ.
 */
export function dedupeSalaryHistoryLatestPerEmployeeMonth<T extends {
  employeeId: string;
  monthYear: string;
  createdAt: Date;
}>(rows: T[]): T[] {
  const map = new Map<string, T>();
  for (const r of rows) {
    const key = `${r.employeeId}\0${r.monthYear}`;
    const prev = map.get(key);
    if (!prev || r.createdAt.getTime() > prev.createdAt.getTime()) {
      map.set(key, r);
    }
  }
  return Array.from(map.values());
}
