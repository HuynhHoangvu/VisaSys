import type { AuthUser } from "../types";

/** Khớp id trong backend/src/constants/permissions.ts */
export const P = {
  rbac: "system.rbac.manage",
  navHr: "nav.hr",
  navDashboard: "nav.dashboard",
  navCrm: "nav.crm",
  navKpi: "nav.kpi",
  navDocuments: "nav.documents",
  navServices: "nav.services",
  navSettings: "nav.settings",
  navBoss: "nav.boss",
  navProcessing: "nav.processing",
  navProcessedDocs: "nav.processed_docs",
  navRecruitment: "nav.recruitment",
  crmSeeAll: "crm.board.see_all",
  kpiWeekEdit: "kpi.week.edit",
  hrRead: "hr.registry.read",
  /** Chấm công / checkout / gửi đơn nghỉ chỉ cho `:id` = chính mình (API đã kiểm tra). */
  hrAttendanceSelf: "hr.attendance.self",
  hrWrite: "hr.registry.write",
  hrDeleteEmployee: "hr.employees.delete",
  hrPayrollFinalize: "hr.payroll.finalize",
  hrPayrollExport: "hr.payroll.export",
  hrLeaveApprove: "hr.leave.approve",
} as const;

function norm(s: string | undefined | null): string {
  return (s || "").trim().toLowerCase();
}

function roleHas(role: string, needle: string): boolean {
  return norm(role).includes(norm(needle));
}

function isBossLike(user: AuthUser): boolean {
  const r = norm(user.role);
  return user.id === "admin" || r.includes("giám đốc") || r.includes("phó giám đốc");
}

function isManagerLike(user: AuthUser): boolean {
  const r = norm(user.role);
  return r.includes("quản lý") || r.includes("trưởng phòng");
}

function isTeacherDept(user: AuthUser): boolean {
  return norm(user.department).includes("giáo viên");
}

function isProcessingDept(user: AuthUser): boolean {
  const d = norm(user.department);
  return ["xử lý hồ sơ", "hồ sơ", "trợ lý giám đốc"].some((x) => d.includes(x));
}

function canProcessingNav(user: AuthUser): boolean {
  return (isBossLike(user) || isProcessingDept(user)) && !isManagerLike(user);
}

/** Fallback khi localStorage chưa có `permissions` (phiên cũ) — khớp logic backend legacy. */
function legacyEffectivePermissions(user: AuthUser): Set<string> {
  if (isTeacherDept(user)) {
    return new Set([P.navHr, P.hrRead, P.hrAttendanceSelf]);
  }
  const perms = new Set<string>([
    P.navHr,
    P.navDashboard,
    P.navCrm,
    P.navKpi,
    P.navDocuments,
    P.navServices,
    P.navSettings,
  ]);
  if (isBossLike(user) || isManagerLike(user)) {
    perms.add(P.navBoss);
    perms.add(P.crmSeeAll);
    perms.add(P.kpiWeekEdit);
  }
  if (isProcessingDept(user) || norm(user.department).includes("marketing")) {
    perms.add(P.crmSeeAll);
  }
  if (canProcessingNav(user)) {
    perms.add(P.navProcessing);
    perms.add(P.navProcessedDocs);
    perms.add(P.navRecruitment);
  }
  perms.add(P.hrRead);
  const deputy = roleHas(user.role, "phó giám đốc");
  const directorLevel = roleHas(user.role, "giám đốc") && !deputy;
  if (directorLevel || deputy || isBossLike(user) || isManagerLike(user)) {
    perms.add(P.hrWrite);
    perms.add(P.hrDeleteEmployee);
    perms.add(P.hrPayrollFinalize);
    perms.add(P.hrPayrollExport);
    perms.add(P.hrLeaveApprove);
  } else {
    perms.add(P.hrAttendanceSelf);
  }
  if (directorLevel || deputy || roleHas(user.role, "admin") || user.id === "admin") {
    perms.add(P.rbac);
  }
  if (user.employeeCode?.toLowerCase() === "nv001") perms.add(P.rbac);
  return perms;
}

export function hasPermission(user: AuthUser | null | undefined, key: string): boolean {
  if (!user) return false;
  const fromApi = user.permissions;
  if (Array.isArray(fromApi) && fromApi.length > 0) {
    return fromApi.includes(key);
  }
  return legacyEffectivePermissions(user).has(key);
}

export function canManageRbac(user: AuthUser | null | undefined): boolean {
  return hasPermission(user, P.rbac);
}

export function defaultHomePath(user: AuthUser): string {
  return hasPermission(user, P.navDashboard) ? "/dashboard" : "/hr";
}
