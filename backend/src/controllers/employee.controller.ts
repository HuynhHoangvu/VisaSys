import { Request, Response } from "express";
import { getIO } from "../socket.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import {
  getEmployeesService,
  getEmployeesBasicService,
  createEmployeeService,
  updateEmployeeService,
  deleteEmployeeService,
} from "../services/employee.service.js";

export const getEmployees = asyncHandler(async (req: Request, res: Response) => {
  const todayStr = new Date().toLocaleDateString("vi-VN");
  const user = (req.session as any).user;
  
  try {
    const employees = await getEmployeesService(user, todayStr);
    res.json(employees);
  } catch (error: any) {
    if (error.message === "Bạn không có quyền thực hiện thao tác này") {
      return res.status(403).json({ error: error.message });
    }
    throw error;
  }
});

export const getEmployeesBasic = asyncHandler(async (_req: Request, res: Response) => {
  const employees = await getEmployeesBasicService();
  res.json(employees);
});

export const createEmployee = asyncHandler(async (req: Request, res: Response) => {
  try {
    const newEmployee = await createEmployeeService(req.body);
    res.status(201).json(newEmployee);
  } catch (error: any) {
    if (error.message === "Email này đã tồn tại trong hệ thống!") {
      return res.status(400).json({ error: error.message });
    }
    throw error;
  }
});

export const updateEmployee = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  try {
    const updated = await updateEmployeeService(id, req.body);
    getIO().emit("data_changed");
    res.json(updated);
  } catch (error: any) {
    if (error.message === "Email này đã được sử dụng bởi nhân viên khác!") {
      return res.status(400).json({ error: error.message });
    }
    throw error;
  }
});

export const deleteEmployee = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  await deleteEmployeeService(id);
  getIO().emit("data_changed");
  res.json({ message: "Xóa thành công" });
});
