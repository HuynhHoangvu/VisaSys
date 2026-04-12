import { Request, Response } from "express";
import { prisma } from "../../lib/prisma.js";
import { getIO } from "../socket.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";

export const getDepartments = asyncHandler(async (_req: Request, res: Response) => {
  const departments = await prisma.department.findMany();
  res.json(departments);
});

export const createDepartment = asyncHandler(async (req: Request, res: Response) => {
  const { name } = req.body;
  const newDept = await prisma.department.create({ data: { name } });
  getIO().emit("data_changed");
  res.status(201).json(newDept);
});

export const updateDepartment = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { name } = req.body;
  const updated = await prisma.department.update({ where: { id }, data: { name } });
  res.json(updated);
});

export const deleteDepartment = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  await prisma.department.delete({ where: { id } });
  res.json({ message: "Xóa thành công" });
});
