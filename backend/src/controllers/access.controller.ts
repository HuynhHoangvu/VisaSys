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
    const [rows, distinctRoles] = await Promise.all([
      prisma.rolePermission.findMany({ orderBy: { role: "asc" } }),
      prisma.employee.findMany({ select: { role: true }, distinct: ["role"] }),
    ]);
    const roleSet = new Set<string>();
    for (const r of rows) roleSet.add(r.role);
    for (const e of distinctRoles) {
      if (e.role?.trim()) roleSet.add(e.role.trim());
    }
    const matrix = [...roleSet].sort().map((role) => {
      const row = rows.find((x) => x.role === role);
      return {
        role,
        permissions: row ? sanitizePermissionList(row.permissions) : [],
      };
    });
    res.json({ matrix, rbacSchemaMissing: false as const });
  } catch (e) {
    if (!isMissingRbacTablesError(e)) throw e;
    const distinctRoles = await prisma.employee.findMany({ select: { role: true }, distinct: ["role"] });
    const roleSet = new Set<string>();
    for (const emp of distinctRoles) {
      if (emp.role?.trim()) roleSet.add(emp.role.trim());
    }
    const matrix = [...roleSet].sort().map((role) => ({ role, permissions: [] as string[] }));
    res.json({
      matrix,
      rbacSchemaMissing: true as const,
      warning:
        "Chưa có bảng RBAC trên database. Chạy trên server: npx prisma migrate deploy (hoặc để Railway release chạy).",
    });
  }
};

export const putAccessMatrix = async (req: Request, res: Response) => {
  const { assignments } = req.body as { assignments: { role: string; permissions: string[] }[] };
  try {
    for (const a of assignments) {
      const role = a.role.trim();
      if (!role) continue;
      const permissions = sanitizePermissionList(a.permissions || []);
      await prisma.rolePermission.upsert({
        where: { role },
        create: { role, permissions },
        update: { permissions },
      });
    }
    res.json({ ok: true });
  } catch (e) {
    if (isMissingRbacTablesError(e)) {
      return res.status(503).json({
        error:
          "Database chưa có bảng RolePermission. Deploy backend với migration RBAC hoặc chạy: npx prisma migrate deploy",
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
  let roleRow: Awaited<ReturnType<typeof prisma.rolePermission.findUnique>> = null;
  let override: Awaited<ReturnType<typeof prisma.employeePermissionOverride.findUnique>> = null;
  let rbacSchemaMissing = false;
  try {
    [roleRow, override] = await Promise.all([
      prisma.rolePermission.findUnique({ where: { role: employee.role.trim() } }),
      prisma.employeePermissionOverride.findUnique({ where: { employeeId: id } }),
    ]);
  } catch (e) {
    if (!isMissingRbacTablesError(e)) throw e;
    rbacSchemaMissing = true;
  }
  const fromRoleDb = roleRow ? sanitizePermissionList(roleRow.permissions) : null;
  const fromRoleLegacy = sanitizePermissionList([...legacyDefaultPermissions(employee)]);
  const effective = await resolveEffectivePermissions(employee);
  res.json({
    employeeId: id,
    role: employee.role,
    rolePermissionsFromDb: fromRoleDb,
    rolePermissionsLegacyPreview: fromRoleLegacy,
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
