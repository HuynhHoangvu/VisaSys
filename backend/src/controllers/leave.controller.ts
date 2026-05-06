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

  const newRequest = await prisma.leaveRequest.create({
    data: { type, startDate, endDate, reason, employeeId: id, status: "Chờ duyệt" },
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
 * Duyệt / từ chối đơn chỉ cập nhật trạng thái để quản lý theo dõi.
 * Khấu trừ lương theo quy tắc chấm công (vắng không điểm danh, đi trễ, về sớm…) — không tự tạo Phạt sales hay xóa phạt chấm công khi duyệt phép.
 */
export const updateLeaveRequestStatus = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { status } = req.body;

  const leaveRequest = await prisma.leaveRequest.findUnique({
    where: { id },
  });
  if (!leaveRequest) {
    return res.status(404).json({ error: "Không tìm thấy đơn xin nghỉ này!" });
  }

  const updated = await prisma.leaveRequest.update({ where: { id }, data: { status } });
  getIO().emit("data_changed");
  res.json(updated);
});
