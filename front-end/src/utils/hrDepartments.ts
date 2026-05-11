import type { Department, Employee } from "../types";

const UNASSIGNED_LABEL = "Chưa phân bổ / Khác";

/** Chuẩn hóa để so khớp tên bộ phận (trim + gom khoảng trắng). */
export function normalizeDeptKey(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

/** Id tạm cho bộ phận chỉ xuất hiện trên nhân viên, chưa có bản ghi Department. */
export function isInferredDepartmentId(id: string): boolean {
  return id.startsWith("__in_use__:");
}

/**
 * Gộp danh sách Department từ API với các tên bộ phận đang gán trên nhân viên
 * nhưng chưa có trong danh mục — tránh lệch giữa bảng HR và modal «Quản lý bộ phận».
 */
export function mergeCatalogWithInUseNames(
  catalog: Department[],
  employees: Employee[],
): Department[] {
  const catalogKeys = new Set(
    catalog.map((d) => normalizeDeptKey(d.name)).filter(Boolean),
  );
  const extras: Department[] = [];
  const seenExtra = new Set<string>();

  for (const emp of employees) {
    const raw = emp.department ?? "";
    const key = normalizeDeptKey(raw);
    if (!key || key === UNASSIGNED_LABEL) continue;
    if (catalogKeys.has(key)) continue;
    if (seenExtra.has(key)) continue;
    seenExtra.add(key);
    extras.push({
      id: `__in_use__:${encodeURIComponent(key)}`,
      name: key,
    });
  }

  return [...catalog, ...extras].sort((a, b) =>
    normalizeDeptKey(a.name).localeCompare(normalizeDeptKey(b.name), "vi"),
  );
}
