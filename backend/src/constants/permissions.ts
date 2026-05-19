/**
 * Single source of truth for permission ids (domain.resource.action).
 * Labels are used by GET /api/access/catalog and the admin Settings UI.
 */
export const PERMISSION_CATALOG = [
  { id: "system.rbac.manage", label: "Quản lý phân quyền (RBAC)", group: "system" },

  { id: "nav.hr", label: "Nhân sự / Chấm công", group: "nav" },
  { id: "nav.dashboard", label: "Tổng quan", group: "nav" },
  { id: "nav.crm", label: "Quản lý khách hàng (CRM)", group: "nav" },
  { id: "nav.kpi", label: "Giao việc tuần (KPI)", group: "nav" },
  { id: "nav.documents", label: "Tài liệu công ty", group: "nav" },
  { id: "nav.services", label: "Dịch vụ", group: "nav" },
  { id: "nav.settings", label: "Cài đặt", group: "nav" },
  { id: "nav.boss", label: "Báo cáo Giám đốc", group: "nav" },
  { id: "nav.processing", label: "Xử lý hồ sơ", group: "nav" },
  { id: "nav.processed_docs", label: "Hồ sơ đã xử lý", group: "nav" },
  { id: "nav.recruitment", label: "Tuyển dụng", group: "nav" },

  { id: "crm.board.see_all", label: "CRM: xem toàn bộ deal / lọc theo sale", group: "crm" },
  { id: "kpi.week.edit", label: "KPI: chỉnh mục tiêu / phân công tuần", group: "kpi" },

  { id: "hr.registry.read", label: "HR: xem tổng thể danh sách, lương, đơn nghỉ", group: "hr" },
  { id: "hr.registry.read_self", label: "HR: tự xem bảng chính mình (lương, đơn nghỉ)", group: "hr" },
  {
    id: "hr.attendance.self",
    label: "HR: tự chấm công, checkout, gửi đơn nghỉ (chỉ bản thân)",
    group: "hr",
  },
  {
    id: "hr.registry.write",
    label: "HR: thêm/sửa NV & phòng ban, thưởng/phạt, miễn trừ chấm công (toàn quyền chỉnh sửa)",
    group: "hr",
  },
  { id: "hr.employees.delete", label: "HR: xóa nhân viên", group: "hr" },
  { id: "hr.payroll.finalize", label: "HR: chốt lương tháng", group: "hr" },
  { id: "hr.payroll.export", label: "HR: xuất phiếu lương / Excel", group: "hr" },
  { id: "hr.leave.approve", label: "HR: duyệt / từ chối đơn nghỉ", group: "hr" },
] as const;

export type PermissionId = (typeof PERMISSION_CATALOG)[number]["id"];

const _valid = new Set<string>(PERMISSION_CATALOG.map((p) => p.id));

export function isValidPermissionId(id: string): boolean {
  return _valid.has(id);
}

export function sanitizePermissionList(ids: string[]): string[] {
  const out: string[] = [];
  for (const id of ids) {
    if (isValidPermissionId(id) && !out.includes(id)) out.push(id);
  }
  return out.sort();
}
