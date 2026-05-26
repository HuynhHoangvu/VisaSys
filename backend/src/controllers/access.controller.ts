import { Request, Response } from "express";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import {
  getAccessCatalogService,
  getAccessMatrixService,
  putAccessMatrixService,
  getAccessEmployeesService,
  getEmployeeAccessEffectiveService,
  putEmployeeAccessOverrideService,
  deleteEmployeeAccessOverrideService,
} from "../services/access.service.js";
import { isMissingRbacTablesError } from "../services/accessResolution.js";

function paramId(req: Request): string {
  const raw = req.params.id;
  return Array.isArray(raw) ? raw[0] : String(raw || "");
}

export const getAccessCatalog = asyncHandler(async (_req: Request, res: Response) => {
  const catalog = getAccessCatalogService();
  res.json({ catalog });
});

export const getAccessMatrix = asyncHandler(async (_req: Request, res: Response) => {
  const result = await getAccessMatrixService();
  res.json(result);
});

export const putAccessMatrix = asyncHandler(async (req: Request, res: Response) => {
  const { assignments } = req.body as {
    assignments: { departmentId: string; permissions: string[] }[];
  };
  try {
    await putAccessMatrixService(assignments);
    res.json({ ok: true });
  } catch (e: any) {
    if (isMissingRbacTablesError(e)) {
      return res.status(503).json({
        error: "Database chưa có bảng DepartmentPermission. Chạy: npx prisma migrate deploy trên server.",
      });
    }
    throw e;
  }
});

export const getAccessEmployees = asyncHandler(async (_req: Request, res: Response) => {
  const list = await getAccessEmployeesService();
  res.json(list);
});

export const getEmployeeAccessEffective = asyncHandler(async (req: Request, res: Response) => {
  const id = paramId(req);
  if (!id) return res.status(400).json({ error: "Thiếu id" });
  try {
    const result = await getEmployeeAccessEffectiveService(id);
    res.json(result);
  } catch (error: any) {
    if (error.message === "Không tìm thấy nhân viên") {
      return res.status(404).json({ error: error.message });
    }
    throw error;
  }
});

export const putEmployeeAccessOverride = asyncHandler(async (req: Request, res: Response) => {
  const id = paramId(req);
  if (!id) return res.status(400).json({ error: "Thiếu id" });
  const { granted, revoked } = req.body as { granted: string[]; revoked: string[] };
  
  try {
    const effective = await putEmployeeAccessOverrideService(id, granted, revoked);
    res.json({ ok: true, effective });
  } catch (e: any) {
    if (e.message === "Không tìm thấy nhân viên") {
      return res.status(404).json({ error: e.message });
    }
    if (isMissingRbacTablesError(e)) {
      return res.status(503).json({
        error: "Database chưa có bảng EmployeePermissionOverride. Chạy: npx prisma migrate deploy trên production.",
      });
    }
    throw e;
  }
});

export const deleteEmployeeAccessOverride = asyncHandler(async (req: Request, res: Response) => {
  const id = paramId(req);
  if (!id) return res.status(400).json({ error: "Thiếu id" });

  try {
    const effective = await deleteEmployeeAccessOverrideService(id);
    res.json({ ok: true, effective });
  } catch (e: any) {
    if (e.message === "Không tìm thấy nhân viên") {
      return res.status(404).json({ error: e.message });
    }
    if (isMissingRbacTablesError(e)) {
      return res.status(503).json({
        error: "Database chưa có bảng EmployeePermissionOverride. Chạy: npx prisma migrate deploy trên production.",
      });
    }
    throw e;
  }
});
