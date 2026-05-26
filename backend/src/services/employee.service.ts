import bcrypt from "bcryptjs";
import { prisma } from "../../lib/prisma.js";
import {
  COMMISSION_RATE_MANAGER,
  COMMISSION_RATE_SALE,
  COMMISSION_RATE_DEFAULT,
  EMPLOYEE_CODE_PREFIX,
} from "../constants/index.js";

export const resolveCommissionRate = (role: string): number => {
  if (role === "Trưởng phòng") return COMMISSION_RATE_MANAGER;
  if (role.includes("Sale")) return COMMISSION_RATE_SALE;
  return COMMISSION_RATE_DEFAULT;
};

export const isBossLike = (role: string, employeeId: string): boolean => {
  const r = role.trim().toLowerCase();
  return employeeId === "admin" || r.includes("giám đốc") || r.includes("phó giám đốc");
};

export const isManagerLike = (role: string): boolean => {
  const r = role.trim().toLowerCase();
  return r.includes("quản lý") || r.includes("trưởng phòng");
};

export const generateEmployeeCode = async (): Promise<string> => {
  const all = await prisma.employee.findMany({ select: { employeeCode: true } });
  const max = all.reduce((acc, e) => {
    const n = parseInt(e.employeeCode.replace(EMPLOYEE_CODE_PREFIX, ""), 10);
    return isNaN(n) ? acc : Math.max(acc, n);
  }, 0);
  return `${EMPLOYEE_CODE_PREFIX}${String(max + 1).padStart(3, "0")}`;
};

export const getEmployeesService = async (user: any, todayStr: string) => {
  const perms: string[] = Array.isArray(user?.permissions) ? user.permissions : [];
  const hasReadFull = perms.includes("hr.registry.read");
  const hasSelfRead = perms.includes("hr.registry.read_self") || perms.includes("hr.attendance.self");

  let whereClause: Record<string, any> = {};

  if (hasReadFull) {
    if (isBossLike(user.role, user.id)) {
      whereClause = {};
    } else if (isManagerLike(user.role)) {
      whereClause = { department: { name: user.department } };
    } else {
      whereClause = { id: user.id };
    }
  } else {
    if (hasSelfRead && user?.id) {
      whereClause = { id: user.id };
    } else {
      throw new Error("Bạn không có quyền thực hiện thao tác này");
    }
  }

  const employees = await prisma.employee.findMany({
    where: whereClause,
    include: {
      department: true,
      attendanceRecords: { orderBy: { createdAt: "desc" } },
      salesRecords: { orderBy: { createdAt: "desc" }, take: 50 },
    },
    orderBy: { createdAt: "asc" },
  });

  return employees.map((emp) => ({
    id: emp.id,
    employeeCode: emp.employeeCode,
    name: emp.name,
    email: emp.email,
    role: emp.role,
    baseSalary: emp.baseSalary,
    commissionRate: emp.commissionRate,
    department: emp.department?.name || "Chưa phân bổ / Khác",
    todayStatus: emp.attendanceRecords.find((r) => r.date === todayStr)?.status ?? "Chưa Check-in",
    attendanceRecords: emp.attendanceRecords,
    salesRecords: emp.salesRecords,
  }));
};

export const getEmployeesBasicService = async () => {
  const employees = await prisma.employee.findMany({
    select: {
      id: true,
      employeeCode: true,
      name: true,
      role: true,
      department: {
        select: {
          name: true,
        },
      },
    },
    orderBy: { name: "asc" },
  });

  return employees.map((emp) => ({
    id: emp.id,
    employeeCode: emp.employeeCode,
    name: emp.name,
    role: emp.role,
    department: emp.department?.name || "Chưa phân bổ / Khác",
  }));
};

export const createEmployeeService = async (data: any) => {
  const { name, email, password, department, role, baseSalary } = data;

  const existing = await prisma.employee.findUnique({ where: { email } });
  if (existing) {
    throw new Error("Email này đã tồn tại trong hệ thống!");
  }

  const deptName = typeof department === "string" ? department.trim() : "";
  const dept = deptName
    ? await prisma.department.findFirst({ where: { name: deptName } })
    : null;
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

  return {
    ...newEmployee,
    department: newEmployee.department?.name || "Chưa phân bổ",
  };
};

export const updateEmployeeService = async (id: string, data: any) => {
  const { name, email, password, department, role, baseSalary } = data;

  const conflicting = await prisma.employee.findFirst({
    where: { email, id: { not: id } },
  });
  if (conflicting) {
    throw new Error("Email này đã được sử dụng bởi nhân viên khác!");
  }

  const deptName = typeof department === "string" ? department.trim() : "";
  const dept = deptName
    ? await prisma.department.findFirst({ where: { name: deptName } })
    : null;

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

  const updated = await prisma.employee.update({
    where: { id },
    data: updateData,
    include: { department: true },
  });

  return {
    id: updated.id,
    employeeCode: updated.employeeCode,
    name: updated.name,
    email: updated.email,
    role: updated.role,
    baseSalary: updated.baseSalary,
    commissionRate: updated.commissionRate,
    department: updated.department?.name || "Chưa phân bổ / Khác",
    departmentId: updated.departmentId,
  };
};

export const deleteEmployeeService = async (id: string) => {
  return prisma.employee.delete({ where: { id } });
};
