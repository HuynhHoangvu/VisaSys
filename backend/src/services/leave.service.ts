import { prisma } from "../../lib/prisma.js";

export const createLeaveRequestService = async (
  employeeId: string,
  data: { type: string; startDate: string; endDate: string; reason: string }
) => {
  const emp = await prisma.employee.findUnique({
    where: { id: employeeId },
    include: { department: true },
  });
  
  if (!emp) throw new Error("Không tìm thấy nhân viên");

  const newRequest = await prisma.leaveRequest.create({
    data: {
      type: data.type,
      paidType: data.type,
      startDate: data.startDate,
      endDate: data.endDate,
      reason: data.reason,
      employeeId,
      status: "Chờ duyệt",
      isBulkLeave: false,
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
      message: `Nhân viên ${emp.name} (${emp.department?.name || "N/A"}) vừa gửi đơn xin ${data.type.toLowerCase()}.`,
      receiver: receivers,
    },
  });

  return { newRequest, empName: emp.name, receivers };
};

export const createBulkLeaveRequestService = async (data: { type: string; startDate: string; endDate: string; reason: string }) => {
  const employees = await prisma.employee.findMany({
    select: { id: true, name: true, department: true },
  });

  if (employees.length === 0) {
    throw new Error("Không có nhân viên nào trong hệ thống");
  }

  const leaveRequests = await prisma.leaveRequest.createMany({
    data: employees.map((emp) => ({
      type: data.type,
      paidType: data.type,
      startDate: data.startDate,
      endDate: data.endDate,
      reason: data.reason,
      employeeId: emp.id,
      status: "Đã duyệt",
      isBulkLeave: true,
    })),
  });

  if (data.type === "Nghỉ có lương") {
    const start = new Date(data.startDate);
    const end = new Date(data.endDate);
    const workDates: string[] = [];

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const day = d.getDay();
      if (day === 0 || day === 6) continue;
      workDates.push(d.toLocaleDateString("vi-VN"));
    }

    for (const emp of employees) {
      for (const dateStr of workDates) {
        const existing = await prisma.attendanceRecord.findFirst({
          where: { employeeId: emp.id, date: dateStr },
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
              employeeId: emp.id,
            },
          });
        }
      }
    }
  }

  await prisma.notification.create({
    data: {
      sender: "Hệ thống",
      message: `Thông báo nghỉ ${data.type.toLowerCase()} từ ${data.startDate} đến ${data.endDate}. Lý do: ${data.reason}`,
      receiver: employees.map((e) => e.name),
    },
  });

  return leaveRequests.count;
};

export const getLeaveRequestsService = async () => {
  return prisma.leaveRequest.findMany({
    include: { employee: { select: { name: true, department: true } } },
    orderBy: { createdAt: "desc" },
  });
};

export const getLeaveRequestsByEmployeeService = async (employeeId: string) => {
  return prisma.leaveRequest.findMany({
    where: { employeeId },
    orderBy: { createdAt: "desc" },
  });
};

export const updateLeaveRequestStatusService = async (id: string, status: string) => {
  const leaveRequest = await prisma.leaveRequest.findUnique({
    where: { id },
    include: { employee: true },
  });
  
  if (!leaveRequest) {
    throw new Error("Không tìm thấy đơn xin nghỉ này!");
  }

  const updated = await prisma.leaveRequest.update({
    where: { id },
    data: { status },
  });

  if (status === "Đã duyệt" && leaveRequest.paidType === "Nghỉ có lương") {
    const startDate = new Date(leaveRequest.startDate);
    const endDate = new Date(leaveRequest.endDate);

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const day = d.getDay();
      if (day === 0 || day === 6) continue;

      const dateStr = d.toLocaleDateString("vi-VN");

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

  return updated;
};
