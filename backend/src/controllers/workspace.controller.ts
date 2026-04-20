import { Request, Response } from "express";
import { prisma } from "../../lib/prisma.js";

// Lấy employeeId từ session (nếu có) hoặc từ query/body
const getEid = (req: Request): string => {
  const fromSession = (req.session as any).user?.id;
  if (fromSession) return String(fromSession);
  const fromQuery = req.query.employeeId ?? req.body?.employeeId;
  return fromQuery ? String(fromQuery) : "";
};

export const getWorkspaces = async (req: Request, res: Response) => {
  try {
    const workspaces = await prisma.workspace.findMany({
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, url: true },
    });
    res.json(workspaces);
  } catch {
    res.status(500).json({ error: "Lỗi khi tải danh sách workspace" });
  }
};

export const createWorkspace = async (req: Request, res: Response) => {
  try {
    const employeeId = getEid(req);
    if (!employeeId) return res.status(400).json({ error: "Thiếu thông tin người dùng" });
    const { name, url } = req.body as { name: string; url?: string; employeeId?: string };
    if (!name?.trim()) {
      return res.status(400).json({ error: "Tên workspace không được để trống" });
    }
    const ws = await prisma.workspace.create({
      data: { name: name.trim(), url: url?.trim() || null, employeeId },
      select: { id: true, name: true, url: true },
    });
    res.status(201).json(ws);
  } catch {
    res.status(500).json({ error: "Lỗi khi tạo workspace" });
  }
};

export const updateWorkspace = async (req: Request, res: Response) => {
  try {
    const employeeId = getEid(req);
    const id = String(req.params.id);
    const { name, url } = req.body as { name: string; url?: string; employeeId?: string };
    if (!name?.trim()) {
      return res.status(400).json({ error: "Tên workspace không được để trống" });
    }
    if (employeeId) {
      const existing = await prisma.workspace.findFirst({ where: { id, employeeId } });
      if (!existing) return res.status(404).json({ error: "Không tìm thấy workspace" });
    }
    const ws = await prisma.workspace.update({
      where: { id },
      data: { name: name.trim(), url: url?.trim() || null },
      select: { id: true, name: true, url: true },
    });
    res.json(ws);
  } catch {
    res.status(500).json({ error: "Lỗi khi cập nhật workspace" });
  }
};

export const deleteWorkspace = async (req: Request, res: Response) => {
  try {
    const employeeId = getEid(req);
    const id = String(req.params.id);

    const countWhere = employeeId ? { employeeId } : { id };
    const count = await prisma.workspace.count({ where: countWhere });
    if (count <= 1) {
      return res.status(400).json({ error: "Phải có ít nhất 1 workspace" });
    }

    await prisma.workspace.delete({ where: { id } });
    res.json({ message: "Đã xoá workspace" });
  } catch {
    res.status(500).json({ error: "Lỗi khi xoá workspace" });
  }
};
