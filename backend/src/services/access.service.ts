import { prisma } from "../../lib/prisma.js";
import { PERMISSION_CATALOG, sanitizePermissionList } from "../constants/permissions.js";
import {
  isMissingRbacTablesError,
  legacyDefaultPermissions,
  resolveEffectivePermissions,
} from "./accessResolution.js";

async function loadEmployeeWithDept(id: string) {
  return prisma.employee.findUnique({
    where: { id },
    include: { department: true },
  });
}

export const getAccessCatalogService = () => {
  return [...PERMISSION_CATALOG];
};

export const getAccessMatrixService = async () => {
  try {
    const [departments, permRows] = await Promise.all([
      prisma.department.findMany({ orderBy: { name: "asc" } }),
      prisma.departmentPermission.findMany(),
    ]);
    const byDept = new Map(permRows.map((p) => [p.departmentId, p.permissions]));
    const matrix = departments.map((d) => ({
      departmentId: d.id,
      departmentName: d.name,
      permissions: sanitizePermissionList(byDept.get(d.id) || []),
    }));
    return { matrix, rbacSchemaMissing: false as const };
  } catch (e) {
    if (!isMissingRbacTablesError(e)) throw e;
    const departments = await prisma.department.findMany({ orderBy: { name: "asc" } });
    const matrix = departments.map((d) => ({
      departmentId: d.id,
      departmentName: d.name,
      permissions: [] as string[],
    }));
    return {
      matrix,
      rbacSchemaMissing: true as const,
      warning:
        "Chưa có bảng DepartmentPermission (hoặc RBAC chưa migrate). Trên server chạy: npx prisma migrate deploy",
    };
  }
};

export const putAccessMatrixService = async (assignments: { departmentId: string; permissions: string[] }[]) => {
  for (const a of assignments) {
    const departmentId = a.departmentId.trim();
    if (!departmentId) continue;
    const exists = await prisma.department.findUnique({
      where: { id: departmentId },
      select: { id: true },
    });
    if (!exists) continue;
    const permissions = sanitizePermissionList(a.permissions || []);
    await prisma.departmentPermission.upsert({
      where: { departmentId },
      create: { departmentId, permissions },
      update: { permissions },
    });
  }
};

export const getAccessEmployeesService = async () => {
  const list = await prisma.employee.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      employeeCode: true,
      role: true,
      department: { select: { name: true } },
    },
  });
  return list.map((e) => ({
    id: e.id,
    name: e.name,
    employeeCode: e.employeeCode,
    role: e.role,
    department: e.department?.name || "",
  }));
};

export const getEmployeeAccessEffectiveService = async (id: string) => {
  const employee = await loadEmployeeWithDept(id);
  if (!employee) throw new Error("Không tìm thấy nhân viên");

  let deptPermRow: Awaited<ReturnType<typeof prisma.departmentPermission.findUnique>> = null;
  let override: Awaited<ReturnType<typeof prisma.employeePermissionOverride.findUnique>> = null;
  let rbacSchemaMissing = false;
  
  try {
    [deptPermRow, override] = await Promise.all([
      employee.departmentId
        ? prisma.departmentPermission.findUnique({ where: { departmentId: employee.departmentId } })
        : Promise.resolve(null),
      prisma.employeePermissionOverride.findUnique({ where: { employeeId: id } }),
    ]);
  } catch (e) {
    if (!isMissingRbacTablesError(e)) throw e;
    rbacSchemaMissing = true;
  }
  
  const fromDeptDb = deptPermRow ? sanitizePermissionList(deptPermRow.permissions) : null;
  const legacyDefaultPreview = sanitizePermissionList([...legacyDefaultPermissions(employee)]);
  const effective = await resolveEffectivePermissions(employee);
  
  return {
    employeeId: id,
    role: employee.role,
    department: employee.department?.name || "",
    departmentPermissionsFromDb: fromDeptDb,
    legacyDefaultPreview,
    override: override
      ? { granted: sanitizePermissionList(override.granted), revoked: sanitizePermissionList(override.revoked) }
      : null,
    effective,
    rbacSchemaMissing,
  };
};

export const putEmployeeAccessOverrideService = async (id: string, granted: string[], revoked: string[]) => {
  const employee = await loadEmployeeWithDept(id);
  if (!employee) throw new Error("Không tìm thấy nhân viên");

  const g = sanitizePermissionList(granted || []);
  const r = sanitizePermissionList(revoked || []);
  
  await prisma.employeePermissionOverride.upsert({
    where: { employeeId: id },
    create: { employeeId: id, granted: g, revoked: r },
    update: { granted: g, revoked: r },
  });

  return resolveEffectivePermissions(employee);
};

export const deleteEmployeeAccessOverrideService = async (id: string) => {
  const employee = await loadEmployeeWithDept(id);
  if (!employee) throw new Error("Không tìm thấy nhân viên");

  await prisma.employeePermissionOverride.deleteMany({ where: { employeeId: id } });

  return resolveEffectivePermissions(employee);
};
