import { Request, Response } from "express";
import { prisma } from "../../lib/prisma.js";
import { getIO } from "../socket.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { STANDARD_WORK_DAYS, SYSTEM_ACTOR } from "../constants/index.js";

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

  // Notify the director, admin, and all Sale department managers.
  // Use a Set to deduplicate in case a manager name matches a fixed receiver.
  const saleManagers = await prisma.employee.findMany({
    where: {
      role: { contains: "Trưởng phòng", mode: "insensitive" },
      department: { name: { contains: "Sale", mode: "insensitive" } },
    },
    select: { name: true },
  });

  const receivers = Array.from(
    new Set(["Giám đốc", "Admin", ...saleManagers.map((m) => m.name.trim())])
  );

  await prisma.notification.create({
    data: {
      sender: emp.name,
      message: `Nhân viên ${emp.name} (Phòng SALE) vừa gửi đơn xin ${type.toLowerCase()}.`,
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
 * Approving a leave request has a financial side effect:
 * a salary deduction record is created dated at the start of the leave period
 * so that it falls into the correct payroll month during finalization.
 * Half-day requests deduct 0.5 days; full leave deducts the calendar day count.
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

  if (status === "Đã duyệt" && leaveRequest.status !== "Đã duyệt") {
    if (leaveRequest.type === "Xin phép nghỉ" || leaveRequest.type === "Nửa ngày") {
      const dailyWage = Math.round((leaveRequest.employee.baseSalary || 0) / STANDARD_WORK_DAYS);
      const diffDays =
        leaveRequest.type === "Nửa ngày"
          ? 0.5
          : Math.round(
              Math.abs(
                new Date(leaveRequest.endDate).getTime() - new Date(leaveRequest.startDate).getTime()
              ) / (1000 * 60 * 60 * 24)
            );

      await prisma.salesRecord.create({
        data: {
          employeeId: leaveRequest.employeeId,
          customer: SYSTEM_ACTOR,
          service: "Phạt",
          profit: -Math.round(dailyWage * diffDays),
          note: `Trừ ${diffDays} ngày lương: Nghỉ phép từ ${leaveRequest.startDate} đến ${leaveRequest.endDate}`,
          // Back-date to the leave start so it lands in the correct payroll month
          createdAt: new Date(leaveRequest.startDate),
        },
      });
    }
  }

  const updated = await prisma.leaveRequest.update({ where: { id }, data: { status } });
  getIO().emit("data_changed");
  res.json(updated);
});
