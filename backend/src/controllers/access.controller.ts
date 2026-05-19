import { Request, Response } from "express";
import { prisma } from "../../lib/prisma.js";
import { PERMISSION_CATALOG, sanitizePermissionList } from "../constants/permissions.js";
import {
  isMissingRbacTablesError,
  legacyDefaultPermissions,
  resolveEffectivePermissions,
} from "../services/accessResolution.js";

async function loadEmployeeWithDept(id: string) {
  return prisma.employee.findUnique({
    where: { id },
    include: { department: true },
  });
}

export const getAccessCatalog = async (_req: Request, res: Response) => {
  res.json({ catalog: [...PERMISSION_CATALOG] });
};

export const getAccessMatrix = async (_req: Request, res: Response) => {
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
    res.json({ matrix, rbacSchemaMissing: false as const });
  } catch (e) {
    if (!isMissingRbacTablesError(e)) throw e;
    const departments = await prisma.department.findMany({ orderBy: { name: "asc" } });
    const matrix = departments.map((d) => ({
      departmentId: d.id,
      departmentName: d.name,
      permissions: [] as string[],
    }));
    res.json({
      matrix,
      rbacSchemaMissing: true as const,
      warning:
        "Chưa có bảng DepartmentPermission (hoặc RBAC chưa migrate). Trên server chạy: npx prisma migrate deploy",
    });
  }
};

export const putAccessMatrix = async (req: Request, res: Response) => {
  const { assignments } = req.body as {
    assignments: { departmentId: string; permissions: string[] }[];
  };
  try {
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
    res.json({ ok: true });
  } catch (e) {
    if (isMissingRbacTablesError(e)) {
      return res.status(503).json({
        error:
          "Database chưa có bảng DepartmentPermission. Chạy: npx prisma migrate deploy trên server.",
      });
    }
    throw e;
  }
};

export const getAccessEmployees = async (_req: Request, res: Response) => {
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
  res.json(
    list.map((e) => ({
      id: e.id,
      name: e.name,
      employeeCode: e.employeeCode,
      role: e.role,
      department: e.department?.name || "",
    })),
  );
};

function paramId(req: Request): string {
  const raw = req.params.id;
  return Array.isArray(raw) ? raw[0] : String(raw || "");
}

export const getEmployeeAccessEffective = async (req: Request, res: Response) => {
  const id = paramId(req);
  if (!id) return res.status(400).json({ error: "Thiếu id" });
  const employee = await loadEmployeeWithDept(id);
  if (!employee) {
    return res.status(404).json({ error: "Không tìm thấy nhân viên" });
  }
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
  res.json({
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
  });
};

export const putEmployeeAccessOverride = async (req: Request, res: Response) => {
  const id = paramId(req);
  if (!id) return res.status(400).json({ error: "Thiếu id" });
  const { granted, revoked } = req.body as { granted: string[]; revoked: string[] };
  const employee = await loadEmployeeWithDept(id);
  if (!employee) {
    return res.status(404).json({ error: "Không tìm thấy nhân viên" });
  }
  const g = sanitizePermissionList(granted || []);
  const r = sanitizePermissionList(revoked || []);
  try {
    await prisma.employeePermissionOverride.upsert({
      where: { employeeId: id },
      create: { employeeId: id, granted: g, revoked: r },
      update: { granted: g, revoked: r },
    });
  } catch (e) {
    if (isMissingRbacTablesError(e)) {
      return res.status(503).json({
        error:
          "Database chưa có bảng EmployeePermissionOverride. Chạy: npx prisma migrate deploy trên production.",
      });
    }
    throw e;
  }
  const effective = await resolveEffectivePermissions(employee);
  res.json({ ok: true, effective });
};

export const deleteEmployeeAccessOverride = async (req: Request, res: Response) => {
  const id = paramId(req);
  if (!id) return res.status(400).json({ error: "Thiếu id" });
  const employee = await loadEmployeeWithDept(id);
  if (!employee) {
    return res.status(404).json({ error: "Không tìm thấy nhân viên" });
  }
  try {
    await prisma.employeePermissionOverride.deleteMany({ where: { employeeId: id } });
  } catch (e) {
    if (isMissingRbacTablesError(e)) {
      return res.status(503).json({
        error:
          "Database chưa có bảng EmployeePermissionOverride. Chạy: npx prisma migrate deploy trên production.",
      });
    }
    throw e;
  }
  const effective = await resolveEffectivePermissions(employee);
  res.json({ ok: true, effective });
};
