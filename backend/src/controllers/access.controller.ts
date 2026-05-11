import { Request, Response } from "express";
import { prisma } from "../../lib/prisma.js";
import { PERMISSION_CATALOG, sanitizePermissionList } from "../constants/permissions.js";
import { legacyDefaultPermissions, resolveEffectivePermissions } from "../services/accessResolution.js";

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
  res.json({ matrix });
};

export const putAccessMatrix = async (req: Request, res: Response) => {
  const { assignments } = req.body as { assignments: { role: string; permissions: string[] }[] };
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
  const [roleRow, override] = await Promise.all([
    prisma.rolePermission.findUnique({ where: { role: employee.role.trim() } }),
    prisma.employeePermissionOverride.findUnique({ where: { employeeId: id } }),
  ]);
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
  await prisma.employeePermissionOverride.upsert({
    where: { employeeId: id },
    create: { employeeId: id, granted: g, revoked: r },
    update: { granted: g, revoked: r },
  });
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
  await prisma.employeePermissionOverride.deleteMany({ where: { employeeId: id } });
  const effective = await resolveEffectivePermissions(employee);
  res.json({ ok: true, effective });
};
