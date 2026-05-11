import type {
  Employee,
  Department,
  EmployeePermissionOverride,
  DepartmentPermission,
} from "../../generated/prisma/client";
import { prisma } from "../../lib/prisma.js";
import { isValidPermissionId, sanitizePermissionList, type PermissionId } from "../constants/permissions.js";

const NAV = {
  hr: "nav.hr",
  dashboard: "nav.dashboard",
  crm: "nav.crm",
  kpi: "nav.kpi",
  documents: "nav.documents",
  services: "nav.services",
  settings: "nav.settings",
  boss: "nav.boss",
  processing: "nav.processing",
  processed_docs: "nav.processed_docs",
  recruitment: "nav.recruitment",
} as const;

function norm(s: string | undefined | null): string {
  return (s || "").trim().toLowerCase();
}

function roleHas(userRole: string, needle: string): boolean {
  return norm(userRole).includes(norm(needle));
}

/** Mirrors legacy Sidebar / App: boss = giám đốc | phó | id legacy admin */
function isBossLike(role: string, employeeId: string): boolean {
  const r = norm(role);
  return employeeId === "admin" || roleHas(role, "giám đốc") || roleHas(role, "phó giám đốc");
}

function isManagerLike(role: string): boolean {
  return roleHas(role, "quản lý") || roleHas(role, "trưởng phòng");
}

function isTeacherDept(deptName: string | undefined | null): boolean {
  return norm(deptName).includes("giáo viên");
}

function isProcessingDept(deptName: string | undefined | null): boolean {
  const d = norm(deptName);
  return ["xử lý hồ sơ", "hồ sơ", "trợ lý giám đốc"].some((x) => d.includes(x));
}

function canAccessProcessingRoutes(role: string, deptName: string | undefined | null, employeeId: string): boolean {
  return (isBossLike(role, employeeId) || isProcessingDept(deptName)) && !isManagerLike(role);
}

/**
 * Default permissions when no DB row for DepartmentPermission (legacy mirror).
 */
export function legacyDefaultPermissions(e: {
  id: string;
  role: string;
  department?: Department | null;
}): Set<string> {
  const deptName = e.department?.name || "";
  const role = e.role;

  if (isTeacherDept(deptName)) {
    return new Set<string>([NAV.hr, "hr.registry.read", "hr.attendance.self"]);
  }

  const perms = new Set<string>([
    NAV.hr,
    NAV.dashboard,
    NAV.crm,
    NAV.kpi,
    NAV.documents,
    NAV.services,
    NAV.settings,
  ]);

  if (isBossLike(role, e.id) || isManagerLike(role)) {
    perms.add(NAV.boss);
    perms.add("crm.board.see_all");
    perms.add("kpi.week.edit");
  }
  if (isProcessingDept(deptName) || norm(deptName).includes("marketing")) {
    perms.add("crm.board.see_all");
  }

  if (canAccessProcessingRoutes(role, deptName, e.id)) {
    perms.add(NAV.processing);
    perms.add(NAV.processed_docs);
    perms.add(NAV.recruitment);
  }

  // HR API / deep permissions — mirror typical power from EmployeeDashboard
  const deputy = roleHas(role, "phó giám đốc");
  const directorLevel = roleHas(role, "giám đốc") && !deputy;
  const boss = isBossLike(role, e.id);
  const manager = isManagerLike(role);

  perms.add("hr.registry.read");
  if (directorLevel || deputy || boss || manager) {
    perms.add("hr.registry.write");
    perms.add("hr.employees.delete");
    perms.add("hr.payroll.finalize");
    perms.add("hr.payroll.export");
    perms.add("hr.leave.approve");
  } else {
    // Nhân viên: xem HR + chỉ chấm công / đơn nghỉ cho bản thân (không gộp vào hr.registry.write)
    perms.add("hr.attendance.self");
  }

  if (directorLevel || deputy || roleHas(role, "admin") || e.id === "admin") {
    perms.add("system.rbac.manage");
  }

  return perms;
}

function intersectCatalog(set: Set<string>): string[] {
  return sanitizePermissionList([...set]);
}

/** DB chưa migrate RBAC (P2021 / bảng chưa tồn tại) — dùng legacy, không crash login/API. */
export function isMissingRbacTablesError(e: unknown): boolean {
  if (!e || typeof e !== "object") return false;
  const err = e as { code?: string; message?: string; meta?: { modelName?: string } };
  if (err.code === "P2021") return true;
  const msg = `${err.message || ""} ${JSON.stringify(err.meta || {})}`;
  if (
    msg.includes("does not exist") &&
    (msg.includes("RolePermission") ||
      msg.includes("DepartmentPermission") ||
      msg.includes("EmployeePermissionOverride"))
  ) {
    return true;
  }
  return false;
}

async function loadDepartmentPermissionRow(
  departmentId: string | null | undefined,
): Promise<DepartmentPermission | null> {
  if (!departmentId?.trim()) return null;
  try {
    return await prisma.departmentPermission.findUnique({
      where: { departmentId: departmentId.trim() },
    });
  } catch (e) {
    if (isMissingRbacTablesError(e)) return null;
    throw e;
  }
}

async function loadOverride(employeeId: string): Promise<EmployeePermissionOverride | null> {
  try {
    return await prisma.employeePermissionOverride.findUnique({ where: { employeeId } });
  } catch (e) {
    if (isMissingRbacTablesError(e)) return null;
    throw e;
  }
}

/**
 * Effective permission set for session + middleware.
 */
export async function buildSessionUserPayload(employeeId: string): Promise<{
  id: string;
  name: string;
  role: string;
  department: string;
  employeeCode: string;
  email: string;
  permissions: string[];
} | null> {
  const full = await prisma.employee.findUnique({
    where: { id: employeeId },
    include: { department: true },
  });
  if (!full) return null;
  const permissions = await resolveEffectivePermissions(full);
  return {
    id: full.id,
    name: full.name,
    role: full.role,
    department: full.department?.name || "Khác",
    employeeCode: full.employeeCode,
    email: full.email,
    permissions,
  };
}

export async function resolveEffectivePermissions(
  employee: Employee & { department: Department | null },
): Promise<string[]> {
  const deptPermRow = await loadDepartmentPermissionRow(employee.departmentId);
  let base: Set<string>;
  if (deptPermRow?.permissions?.length) {
    base = new Set(sanitizePermissionList(deptPermRow.permissions));
  } else {
    base = legacyDefaultPermissions(employee);
  }

  const ov = await loadOverride(employee.id);
  if (ov) {
    const g = sanitizePermissionList(ov.granted);
    const r = new Set(sanitizePermissionList(ov.revoked));
    for (const x of g) base.add(x);
    for (const x of r) base.delete(x);
  }

  // Department clamps (teacher-only HR nav; processing nav consistency)
  const deptName = employee.department?.name || "";
  if (isTeacherDept(deptName)) {
    base = new Set(
      [NAV.hr, "hr.registry.read", "hr.attendance.self"].filter((id) => isValidPermissionId(id)),
    );
  } else {
    if (!canAccessProcessingRoutes(employee.role, deptName, employee.id)) {
      base.delete(NAV.processing);
      base.delete(NAV.processed_docs);
      base.delete(NAV.recruitment);
    }
    if (!isBossLike(employee.role, employee.id) && !isManagerLike(employee.role)) {
      base.delete(NAV.boss);
      base.delete("crm.board.see_all");
      base.delete("kpi.week.edit");
    }
  }

  return intersectCatalog(base);
}

export function canManageRbac(permissions: string[], role: string, employeeCode: string): boolean {
  if (permissions.includes("system.rbac.manage")) return true;
  const r = norm(role);
  return r.includes("giám đốc") || employeeCode.toLowerCase() === "nv001";
}

export type { PermissionId };
