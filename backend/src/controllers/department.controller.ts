import { Request, Response } from "express";
import { getIO } from "../socket.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import {
  getDepartmentsService,
  createDepartmentService,
  updateDepartmentService,
  deleteDepartmentService,
} from "../services/department.service.js";

export const getDepartments = asyncHandler(async (_req: Request, res: Response) => {
  const departments = await getDepartmentsService();
  res.json(departments);
});

export const createDepartment = asyncHandler(async (req: Request, res: Response) => {
  const { name } = req.body;
  const newDept = await createDepartmentService(name);
  getIO().emit("data_changed");
  res.status(201).json(newDept);
});

export const updateDepartment = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { name } = req.body;
  const updated = await updateDepartmentService(id, name);
  getIO().emit("data_changed"); // Giữ nguyên hành vi hoặc thêm emit nếu cần
  res.json(updated);
});

export const deleteDepartment = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  await deleteDepartmentService(id);
  getIO().emit("data_changed");
  res.json({ message: "Xóa thành công" });
});
