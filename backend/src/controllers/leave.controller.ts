import { Request, Response } from "express";
import { prisma } from "../../lib/prisma.js";
import { getIO } from "../socket.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";

export const createLeaveRequest = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { type, startDate, endDate, reason } = req.body;

  const emp = await prisma.employee.findUnique({
    where: { id },
    include: { department: true },
  });
  if (!emp) return res.status(404).json({ error: "Không tìm thấy nhân viên" });

  // paidType = type (Vô trễ, Nghỉ không lương, Nghỉ có lương)
  const newRequest = await prisma.leaveRequest.create({
    data: { 
      type, 
      paidType: type, 
      startDate, 
      endDate, 
      reason, 
      employeeId: id, 
      status: "Chờ duyệt",
      isBulkLeave: false 
    },
  });

  const saleManagers = await prisma.employee.findMany({
    where: {
      role: { contains: "Trưởng phòng", mode: "insensitive" },
      department: { name: { contains: "Sale", mode: "insensitive" } },
    },
    select: { name: true },
  });

  const receivers = Array.from(
    new Set(["Giám đốc", "Admin", ...saleManagers.map((m) => m.name.trim())]),
  );

  await prisma.notification.create({
    data: {
      sender: emp.name,
      message: `Nhân viên ${emp.name} (${emp.department?.name || "N/A"}) vừa gửi đơn xin ${type.toLowerCase()}.`,
      receiver: receivers,
    },
  });

  getIO().emit("new_notification", { message: `Có đơn mới từ ${emp.name}`, receivers });
  getIO().emit("data_changed");
  res.status(201).json(newRequest);
});

/**
 * Tạo đơn nghỉ đồng loạt cho tất cả nhân viên (sếp/admin)
 */
export const createBulkLeaveRequest = asyncHandler(async (req: Request, res: Response) => {
  const { type, startDate, endDate, reason } = req.body;

  // Lấy tất cả nhân viên
  const employees = await prisma.employee.findMany({
    select: { id: true, name: true, department: true },
  });

  if (employees.length === 0) {
    return res.status(400).json({ error: "Không có nhân viên nào trong hệ thống" });
  }

  // Tạo đơn cho tất cả nhân viên
  const leaveRequests = await prisma.leaveRequest.createMany({
    data: employees.map((emp) => ({
      type,
      paidType: type,
      startDate,
      endDate,
      reason,
      employeeId: emp.id,
      status: "Đã duyệt", // Tự động duyệt khi sếp tạo
      isBulkLeave: true,
    })),
  });

  // Gửi thông báo
  await prisma.notification.create({
    data: {
      sender: "Hệ thống",
      message: `Thông báo nghỉ ${type.toLowerCase()} từ ${startDate} đến ${endDate}. Lý do: ${reason}`,
      receiver: employees.map((e) => e.name),
    },
  });

  getIO().emit("data_changed");
  res.status(201).json({ 
    success: true, 
    count: leaveRequests.count,
    message: `Đã tạo đơn nghỉ cho ${leaveRequests.count} nhân viên` 
  });
});

export const getLeaveRequests = asyncHandler(async (_req: Request, res: Response) => {
  const requests = await prisma.leaveRequest.findMany({
    include: { employee: { select: { name: true, department: true } } },
    orderBy: { createdAt: "desc" },
  });
  res.json(requests);
});

export const getLeaveRequestsByEmployee = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const requests = await prisma.leaveRequest.findMany({
    where: { employeeId: id },
    orderBy: { createdAt: "desc" },
  });
  res.json(requests);
});

/**
 * Duyệt / từ chối đơn
 * - Nghỉ có lương: Tạo attendance record "Có phép" để không trừ lương
 */
export const updateLeaveRequestStatus = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { status } = req.body;

  const leaveRequest = await prisma.leaveRequest.findUnique({
    where: { id },
    include: { employee: true },
  });
  if (!leaveRequest) {
    return res.status(404).json({ error: "Không tìm thấy đơn xin nghỉ này!" });
  }

  const updated = await prisma.leaveRequest.update({ 
    where: { id }, 
    data: { status } 
  });

  // Nếu duyệt đơn "Nghỉ có lương" -> tạo attendance records
  if (status === "Đã duyệt" && leaveRequest.paidType === "Nghỉ có lương") {
    const startDate = new Date(leaveRequest.startDate);
    const endDate = new Date(leaveRequest.endDate);
    
    // Tạo attendance record cho mỗi ngày trong khoảng
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const day = d.getDay();
      // Bỏ qua T7, CN
      if (day === 0 || day === 6) continue;
      
      const dateStr = d.toLocaleDateString("vi-VN");
      
      // Kiểm tra xem đã có record chưa
      const existing = await prisma.attendanceRecord.findFirst({
        where: { employeeId: leaveRequest.employeeId, date: dateStr },
      });
      
      if (!existing) {
        await prisma.attendanceRecord.create({
          data: {
            date: dateStr,
            inTime: "08:00",
            outTime: "17:00",
            status: "Nghỉ có lương",
            fine: 0,
            halfDayDeduction: 0,
            employeeId: leaveRequest.employeeId,
          },
        });
      }
    }
  }

  getIO().emit("data_changed");
  res.json(updated);
});
