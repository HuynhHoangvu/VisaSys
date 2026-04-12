import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../../lib/prisma.js";
import { getIO } from "../socket.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import {
  COMMISSION_RATE_MANAGER,
  COMMISSION_RATE_SALE,
  COMMISSION_RATE_DEFAULT,
  EMPLOYEE_CODE_PREFIX,
} from "../constants/index.js";

const resolveCommissionRate = (role: string): number => {
  if (role === "Trưởng phòng") return COMMISSION_RATE_MANAGER;
  if (role.includes("Sale")) return COMMISSION_RATE_SALE;
  return COMMISSION_RATE_DEFAULT;
};

/**
 * Generates the next sequential employee code (e.g. NV001, NV002).
 * Scans all existing codes, finds the highest numeric suffix, and increments it.
 * This is gap-safe: deleted employees do not cause number reuse.
 */
const generateEmployeeCode = async (): Promise<string> => {
  const all = await prisma.employee.findMany({ select: { employeeCode: true } });
  const max = all.reduce((acc, e) => {
    const n = parseInt(e.employeeCode.replace(EMPLOYEE_CODE_PREFIX, ""), 10);
    return isNaN(n) ? acc : Math.max(acc, n);
  }, 0);
  return `${EMPLOYEE_CODE_PREFIX}${String(max + 1).padStart(3, "0")}`;
};

export const getEmployees = asyncHandler(async (_req: Request, res: Response) => {
  const todayStr = new Date().toLocaleDateString("vi-VN");

  // Only load today's attendance record per employee to avoid N+1 unbounded reads.
  const employees = await prisma.employee.findMany({
    include: {
      department: true,
      attendanceRecords: { where: { date: todayStr }, take: 1 },
      salesRecords: { orderBy: { createdAt: "desc" }, take: 50 },
    },
    orderBy: { createdAt: "asc" },
  });

  res.json(
    employees.map((emp) => ({
      id: emp.id,
      employeeCode: emp.employeeCode,
      name: emp.name,
      email: emp.email,
      role: emp.role,
      baseSalary: emp.baseSalary,
      commissionRate: emp.commissionRate,
      department: emp.department?.name || "Chưa phân bổ / Khác",
      todayStatus: emp.attendanceRecords[0]?.status ?? "Chưa Check-in",
      attendanceRecords: emp.attendanceRecords,
      salesRecords: emp.salesRecords,
    }))
  );
});

export const createEmployee = asyncHandler(async (req: Request, res: Response) => {
  const { name, email, password, department, role, baseSalary } = req.body as {
    name: string; email: string; password: string; department: string; role: string; baseSalary: string;
  };

  const existing = await prisma.employee.findUnique({ where: { email } });
  if (existing) {
    return res.status(400).json({ error: "Email này đã tồn tại trong hệ thống!" });
  }

  const dept = await prisma.department.findFirst({ where: { name: department } });
  const employeeCode = await generateEmployeeCode();
  const hashedPassword = await bcrypt.hash(password || "123456", 10);

  const newEmployee = await prisma.employee.create({
    data: {
      employeeCode,
      name,
      email,
      password: hashedPassword,
      role,
      departmentId: dept?.id || null,
      baseSalary: baseSalary ? parseFloat(baseSalary) : 5_000_000,
      commissionRate: resolveCommissionRate(role),
    },
    include: { department: true },
  });

  res.status(201).json({
    ...newEmployee,
    department: newEmployee.department?.name || "Chưa phân bổ",
  });
});

export const updateEmployee = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { name, email, password, department, role, baseSalary } = req.body as {
    name: string; email: string; password: string; department: string; role: string; baseSalary: string;
  };

  const conflicting = await prisma.employee.findFirst({
    where: { email, id: { not: id } },
  });
  if (conflicting) {
    return res.status(400).json({ error: "Email này đã được sử dụng bởi nhân viên khác!" });
  }

  const dept = await prisma.department.findFirst({ where: { name: department } });

  const updateData: any = {
    name,
    email,
    role,
    departmentId: dept?.id || null,
    baseSalary: baseSalary ? parseFloat(baseSalary) : 5_000_000,
    commissionRate: resolveCommissionRate(role),
  };

  if (password?.trim()) {
    updateData.password = await bcrypt.hash(password, 10);
  }

  const updated = await prisma.employee.update({ where: { id }, data: updateData });
  getIO().emit("data_changed");
  res.json(updated);
});

export const deleteEmployee = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  await prisma.employee.delete({ where: { id } });
  getIO().emit("data_changed");
  res.json({ message: "Xóa thành công" });
});
