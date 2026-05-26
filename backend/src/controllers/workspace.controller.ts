import { Request, Response } from "express";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import {
  getWorkspacesService,
  createWorkspaceService,
  updateWorkspaceService,
  deleteWorkspaceService,
} from "../services/workspace.service.js";

// Lấy employeeId từ session (nếu có) hoặc từ query/body
const getEid = (req: Request): string => {
  const fromSession = (req.session as any).user?.id;
  if (fromSession) return String(fromSession);
  const fromQuery = req.query.employeeId ?? req.body?.employeeId;
  return fromQuery ? String(fromQuery) : "";
};

export const getWorkspaces = asyncHandler(async (req: Request, res: Response) => {
  try {
    const workspaces = await getWorkspacesService();
    res.json(workspaces);
  } catch {
    res.status(500).json({ error: "Lỗi khi tải danh sách workspace" });
  }
});

export const createWorkspace = asyncHandler(async (req: Request, res: Response) => {
  try {
    const employeeId = getEid(req);
    if (!employeeId) return res.status(400).json({ error: "Thiếu thông tin người dùng" });
    const { name, url } = req.body as { name: string; url?: string; employeeId?: string };
    if (!name?.trim()) {
      return res.status(400).json({ error: "Tên workspace không được để trống" });
    }
    const ws = await createWorkspaceService(name, url, employeeId);
    res.status(201).json(ws);
  } catch {
    res.status(500).json({ error: "Lỗi khi tạo workspace" });
  }
});

export const updateWorkspace = asyncHandler(async (req: Request, res: Response) => {
  try {
    const employeeId = getEid(req);
    const id = String(req.params.id);
    const { name, url } = req.body as { name: string; url?: string; employeeId?: string };
    if (!name?.trim()) {
      return res.status(400).json({ error: "Tên workspace không được để trống" });
    }
    const ws = await updateWorkspaceService(id, name, url, employeeId);
    res.json(ws);
  } catch (error: any) {
    if (error.message === "Không tìm thấy workspace") {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: "Lỗi khi cập nhật workspace" });
  }
});

export const deleteWorkspace = asyncHandler(async (req: Request, res: Response) => {
  try {
    const employeeId = getEid(req);
    const id = String(req.params.id);

    await deleteWorkspaceService(id, employeeId);
    res.json({ message: "Đã xoá workspace" });
  } catch (error: any) {
    if (error.message === "Phải có ít nhất 1 workspace") {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: "Lỗi khi xoá workspace" });
  }
});
