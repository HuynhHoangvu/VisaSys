import { Request, Response } from "express";
import { prisma } from "../../lib/prisma.js";
import { getIO } from "../socket.js";


// ==========================================
// HELPER: Tính số ngày làm việc T2-T6 trong tháng
// ==========================================
const getWorkDaysInMonth = (year: number, month: number): number => {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  let count = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const day = new Date(year, month, d).getDay();
    if (day !== 0 && day !== 6) count++;
  }
  return count;
};


// ==========================================
// 2. QUẢN LÝ PHÒNG BAN
// ==========================================
export const getDepartments = async (req: Request, res: Response) => {
  try {
    const departments = await prisma.department.findMany();
    res.json(departments);
  } catch (error) {
    res.status(500).json({ error: "Lỗi lấy danh sách phòng ban" });
  }
};

export const createDepartment = async (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    const newDept = await prisma.department.create({ data: { name } });
    getIO().emit("data_changed");
    res.status(201).json(newDept);
  } catch (error) {
    res.status(500).json({ error: "Lỗi tạo phòng ban" });
  }
};

export const updateDepartment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    const updatedDept = await prisma.department.update({
      where: { id: id as string },
      data: { name }
    });
    res.json(updatedDept);
  } catch (error) {
    res.status(500).json({ error: "Lỗi cập nhật phòng ban" });
  }
};

export const deleteDepartment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.department.delete({ where: { id: id as string } });
    res.json({ message: "Xóa thành công" });
  } catch (error) {
    res.status(500).json({ error: "Lỗi xóa phòng ban" });
  }
};

// ==========================================
// 3. QUẢN LÝ NHÂN VIÊN (EMPLOYEE)
// ==========================================
export const getEmployees = async (req: Request, res: Response) => {
  try {
    const employees = await prisma.employee.findMany({
      include: {
        department: true,
        attendanceRecords: { orderBy: { createdAt: 'desc' } },
        salesRecords: { orderBy: { createdAt: 'desc' } }
      }
    });

    const todayStr = new Date().toLocaleDateString("vi-VN");

    const formattedEmployees = employees.map(emp => {
      const todayRecord = emp.attendanceRecords.find(r => r.date === todayStr);

      return {
        id: emp.id,
        employeeCode: emp.employeeCode,
        name: emp.name,
        email: emp.email,
        role: emp.role,
        baseSalary: emp.baseSalary,
        commissionRate: emp.commissionRate,
        department: emp.department?.name || "Chưa phân bổ / Khác",
        todayStatus: todayRecord ? todayRecord.status : "Chưa Check-in",
        attendanceRecords: emp.attendanceRecords,
        salesRecords: emp.salesRecords
      };
    });

    res.json(formattedEmployees);
  } catch (error) {
    res.status(500).json({ error: "Lỗi lấy danh sách nhân viên" });
  }
};

export const createEmployee = async (req: Request, res: Response) => {
  try {
    const { name, email, password, department, role, baseSalary } = req.body;

    const existingEmployee = await prisma.employee.findUnique({
      where: { email },
    });
    if (existingEmployee) {
      return res.status(400).json({ error: "Email này đã tồn tại trong hệ thống!" });
    }

    const dept = await prisma.department.findFirst({ where: { name: department } });

    const allEmployees = await prisma.employee.findMany({
      select: { employeeCode: true }
    });

    let nextNumber = 1;
    if (allEmployees.length > 0) {
      const maxNumber = allEmployees
        .map(e => {
          const num = parseInt(e.employeeCode.replace('NV', ''), 10);
          return isNaN(num) ? 0 : num;
        })
        .reduce((max, n) => Math.max(max, n), 0);
      nextNumber = maxNumber + 1;
    }

    const employeeCode = `NV${String(nextNumber).padStart(3, '0')}`;

    const newEmployee = await prisma.employee.create({
      data: {
        employeeCode,
        name,
        email,
        password: password || "123456",
        role,
        departmentId: dept?.id || null,
        baseSalary: baseSalary ? parseFloat(baseSalary) : 5000000,
        commissionRate: role === "Trưởng phòng" ? 0.15 : (role.includes("Sale") ? 0.1 : 0)
      },
      include: {
        department: true
      }
    });

    res.status(201).json({
      ...newEmployee,
      department: newEmployee.department?.name || "Chưa phân bổ"
    });
  } catch (error) {
    console.error("Lỗi tạo nhân viên:", error);
    res.status(500).json({ error: "Lỗi Server khi tạo nhân viên" });
  }
};

export const updateEmployee = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string; 
    const { name, email, password, department, role, baseSalary } = req.body;

    const existingEmployee = await prisma.employee.findFirst({
      where: { 
        email, 
        id: { not: id } 
      },
    });
    
    if (existingEmployee) {
      return res.status(400).json({ error: "Email này đã được sử dụng bởi nhân viên khác!" });
    }

    const dept = await prisma.department.findFirst({ where: { name: department } });

    const updateData: any = {
      name,
      email,
      role,
      departmentId: dept?.id || null,
      baseSalary: baseSalary ? parseFloat(baseSalary) : 5000000,
      commissionRate: role === "Trưởng phòng" ? 0.15 : (role.includes("Sale") ? 0.1 : 0)
    };

    if (password && password.trim() !== "") {
      updateData.password = password;
    }

    const updatedEmployee = await prisma.employee.update({
      where: { id }, 
      data: updateData,
    });

    getIO().emit("data_changed");
    res.json(updatedEmployee);
  } catch (error) {
    console.error("Lỗi cập nhật nhân viên:", error);
    res.status(500).json({ error: "Lỗi Server khi cập nhật nhân viên" });
  }
};

export const deleteEmployee = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.employee.delete({ where: { id: id as string } });
    getIO().emit("data_changed");
    res.json({ message: "Xóa thành công" });
  } catch (error) {
    res.status(500).json({ error: "Lỗi xóa nhân viên" });
  }
};

// ==========================================
// 4. CHECK-IN / CHECK-OUT
// ==========================================
export const checkInEmployee = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    let { date, inTime, outTime, status, fine } = req.body;

    const now = new Date();
    const timeZone = "Asia/Ho_Chi_Minh";
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone, year: "numeric", month: "2-digit", day: "2-digit"
    });
    
    const parts = formatter.formatToParts(now);
    let vnYear = "", vnMonth = "", vnDay = "";
    parts.forEach(part => {
      if (part.type === "year") vnYear = part.value;
      if (part.type === "month") vnMonth = part.value;
      if (part.type === "day") vnDay = part.value;
    });

    const todayISO = `${vnYear}-${vnMonth}-${vnDay}`;

    const approvedLeave = await prisma.leaveRequest.findFirst({
      where: {
        employeeId: id as string,
        status: "Đã duyệt",
        startDate: { lte: todayISO },
        endDate: { gte: todayISO },
      }
    });

    if (approvedLeave) {
      fine = 0; 
      if (status === "Đi muộn") {
        status = "Đi muộn (Có phép)"; 
      }
    }

    const newRecord = await prisma.attendanceRecord.create({
      data: {
        date,
        inTime,
        outTime,
        status,
        fine,
        employeeId: id as string
      }
    });
    getIO().emit("data_changed");
    res.status(201).json(newRecord);
  } catch (error) {
    res.status(500).json({ error: "Lỗi lưu chấm công vào Database" });
  }
};

export const checkOutEmployee = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const now = new Date();
    
    const timeZone = "Asia/Ho_Chi_Minh";
    const todayStr = now.toLocaleDateString("vi-VN", { timeZone });
    const outTime = now.toLocaleTimeString("vi-VN", { timeZone, hour: "2-digit", minute: "2-digit" } as Intl.DateTimeFormatOptions);

    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone, hour: "numeric", minute: "numeric", year: "numeric", month: "2-digit", day: "2-digit", hour12: false
    } as Intl.DateTimeFormatOptions);

    const parts = formatter.formatToParts(now);
    let vnHour = 0, vnMinute = 0, vnYear = "", vnMonth = "", vnDay = "";
    parts.forEach(part => {
      if (part.type === "hour") vnHour = parseInt(part.value, 10) % 24; 
      if (part.type === "minute") vnMinute = parseInt(part.value, 10);
      if (part.type === "year") vnYear = part.value;
      if (part.type === "month") vnMonth = part.value;
      if (part.type === "day") vnDay = part.value;
    });

    const todayRecord = await prisma.attendanceRecord.findFirst({
      where: { employeeId: id, date: todayStr },
    });

    if (!todayRecord) return res.status(400).json({ error: "Chưa check-in hôm nay!" });
    if (todayRecord.outTime && todayRecord.outTime !== "-") return res.status(400).json({ error: "Đã check-out rồi!" });

    const outMinutes = vnHour * 60 + vnMinute;
    const isEarlyLeave = outMinutes < 17 * 60;

    let halfDayDeduction = 0;
    let newStatus = todayRecord.status;

    if (isEarlyLeave) {
      const todayISO = `${vnYear}-${vnMonth}-${vnDay}`; 
      
      const approvedLeave = await prisma.leaveRequest.findFirst({
        where: {
          employeeId: id,
          status: "Đã duyệt",
          startDate: { lte: todayISO },
          endDate: { gte: todayISO },
        },
      });

      if (!approvedLeave) {
        const employee = await prisma.employee.findUnique({ where: { id: id } });
        const workDays = getWorkDaysInMonth(parseInt(vnYear), parseInt(vnMonth) - 1); 
        halfDayDeduction = Math.round((employee!.baseSalary || 0) / workDays / 2);
        
        newStatus = todayRecord.status === "Đúng giờ" || todayRecord.status.includes("Có phép")
          ? "Về sớm"
          : `${todayRecord.status} + Về sớm`;
      } else {
        newStatus = todayRecord.status === "Đúng giờ" || todayRecord.status.includes("Có phép")
          ? "Về sớm (Có phép)"
          : `${todayRecord.status} + Về sớm (Có phép)`;
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.attendanceRecord.update({
        where: { id: todayRecord.id },
        data: { outTime, status: newStatus, halfDayDeduction },
      });

      if (halfDayDeduction > 0) {
        await tx.salesRecord.create({
          data: {
            employeeId: id,
            customer: "Hệ thống tự động",
            service: "Phạt",
            profit: -halfDayDeduction,
            note: `Về sớm lúc ${outTime} ngày ${todayStr} (chưa được duyệt phép)`,
          },
        });
      }
    });

    getIO().emit("data_changed");
    res.json({ success: true, isEarlyLeave, halfDayDeduction, outTime, hasLeaveApproval: halfDayDeduction === 0 });
  } catch (error) {
    console.error("Lỗi check-out:", error);
    res.status(500).json({ error: "Lỗi hệ thống khi check-out" });
  }
};

export const penalizeForgotCheckout = async (req: Request, res: Response) => {
  try {
    const now = new Date();
    const todayStr = now.toLocaleDateString("vi-VN");

    const forgotRecords = await prisma.attendanceRecord.findMany({
      where: {
        date: todayStr,
        outTime: "-",
        halfDayDeduction: 0,
      },
      include: { employee: true },
    });

    for (const record of forgotRecords) {
      const workDays = getWorkDaysInMonth(now.getFullYear(), now.getMonth());
      const halfDayDeduction = Math.round(
        (record.employee.baseSalary || 0) / workDays / 2
      );

      await prisma.$transaction(async (tx) => {
        await tx.attendanceRecord.update({
          where: { id: record.id },
          data: {
            outTime: "Quên checkout",
            status: "Quên checkout",
            halfDayDeduction: halfDayDeduction,
          },
        });

        await tx.salesRecord.create({
          data: {
            employeeId: record.employeeId,
            customer: "Hệ thống tự động",
            service: "Phạt",
            profit: -halfDayDeduction,
            note: `Quên check-out ngày ${todayStr} — mất nửa ngày công`,
          },
        });
      });
    }

    res.json({ success: true, penalized: forgotRecords.length });
  } catch (error) {
    res.status(500).json({ error: "Lỗi xử lý quên checkout" });
  }
};

// ==========================================
// 5. THƯỞNG PHẠT THỦ CÔNG
// ==========================================
export const addManualBonus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { customer, service, profit, note } = req.body;

    const newRecord = await prisma.salesRecord.create({
      data: {
        employeeId: id as string,
        customer,
        service,
        profit: Number(profit),
        note,
      }
    });

    getIO().emit("data_changed");
    res.status(201).json(newRecord);
  } catch (error) {
    res.status(500).json({ error: "Lỗi lưu thưởng phạt" });
  }
};

// ==========================================
// 6. CHỐT LƯƠNG & LỊCH SỬ LƯƠNG 
// ==========================================
export const finalizeMonthSalary = async (req: Request, res: Response) => {
  try {
    const { monthYear } = req.body;
    if (!monthYear) return res.status(400).json({ error: "Vui lòng cung cấp tháng chốt lương!" });

    const [mmStr, yyyyStr] = monthYear.split('/');
    const mm = parseInt(mmStr);
    const yyyy = parseInt(yyyyStr);

    const employees = await prisma.employee.findMany({
      include: { salesRecords: true, attendanceRecords: true }
    });

    await prisma.$transaction(async (tx) => {
      const attIdsToDelete: string[] = [];
      const saleIdsToDelete: string[] = [];

      for (const emp of employees) {
        // 1. Lọc data thô CÒN SÓT LẠI của tháng
        const monthAtt = emp.attendanceRecords.filter(r => {
          if (!r.date) return false;
          const parts = r.date.split('/');
          return parts.length === 3 && parseInt(parts[1]) === mm && parseInt(parts[2]) === yyyy;
        });

        const monthSales = emp.salesRecords.filter(r => {
          if (!r.createdAt) return false;
          const d = new Date(r.createdAt);
          return (d.getMonth() + 1) === mm && d.getFullYear() === yyyy;
        });

        monthAtt.forEach(r => attIdsToDelete.push(r.id));
        monthSales.forEach(r => saleIdsToDelete.push(r.id));

        // 2. Tính các khoản mới phát sinh trong lần chốt này
        let newHoaHong = 0, newTamUng = 0, newManualFines = 0;
        monthSales.forEach((record) => {
          const amount = Number(record.profit) || 0;
          if (record.service === "Phạt") newManualFines += Math.abs(amount);
          else if (record.service === "Tạm ứng") newTamUng += Math.abs(amount);
          else if (!["Chuyên cần", "Ăn trưa", "Hỗ trợ khác"].includes(record.service || "")) {
            newHoaHong += amount;
          }
        });

        const newAttendanceFines = monthAtt.reduce((sum, r) => sum + (r.fine || 0), 0);
        const newHalfDay = monthAtt.reduce((sum, r) => sum + (r.halfDayDeduction || 0), 0);
        const threshold = 8_000_000;
        const totalSalaryBrutto = emp.baseSalary || 0;
        const ins = totalSalaryBrutto >= threshold ? totalSalaryBrutto - 2_000_000 : totalSalaryBrutto;
        
        const newFullDay = monthAtt.reduce((sum, r) => {
          return r.status === "Vắng không phép" ? sum + Math.round(ins / 21) : sum;
        }, 0);

        const newWorkDates = monthAtt.filter(r => r.outTime && r.outTime !== "-" && r.outTime !== "Quên checkout").map(r => r.date);

        // 3. TÌM XEM THÁNG NÀY ĐÃ TỪNG CHỐT CHƯA
        const existingHistory = await tx.salaryHistory.findFirst({
          where: { employeeId: emp.id, monthYear: monthYear }
        });

        // 4. CỘNG DỒN DỮ LIỆU (Cũ + Mới)
        const finalHoaHong = (existingHistory?.hoaHong || 0) + newHoaHong;
        const finalTamUng = (existingHistory?.tamUng || 0) + newTamUng;
        const finalManualFines = (existingHistory?.manualFines || 0) + newManualFines;
        const finalAttendanceFines = (existingHistory?.attendanceFines || 0) + newAttendanceFines;
        const finalHalfDay = (existingHistory?.halfDayDeduction || 0) + newHalfDay;
        const finalFullDay = (existingHistory?.fullDayAbsenceDeduction || 0) + newFullDay;
        
        // Gộp danh sách ngày đi làm, dùng Set để loại bỏ ngày trùng lặp nếu có
        const oldDates = existingHistory?.workDates || [];
        const finalWorkDates = Array.from(new Set([...oldDates, ...newWorkDates]));
        const finalWorkDays = finalWorkDates.length;

        // 5. TÍNH LẠI LƯƠNG TỔNG QUÁT TỪ CÁC CON SỐ ĐÃ CỘNG DỒN
        const cc  = totalSalaryBrutto >= threshold ? 1_000_000 : 0;
        const at  = totalSalaryBrutto >= threshold ?   500_000 : 0;
        const htk = totalSalaryBrutto >= threshold ?   500_000 : 0;

        const bhxhNld  = Math.round(ins * 0.08);
        const bhytNld  = Math.round(ins * 0.015);
        const bhtnNld  = Math.round(ins * 0.01);
        const totalNld = bhxhNld + bhytNld + bhtnNld;

        const totalBonus = cc + at + htk + finalHoaHong;
        const totalSalary = ins + totalBonus;

        const totalDeductions = finalManualFines + finalAttendanceFines + finalHalfDay + finalFullDay + totalNld;
        const finalSalary = totalSalary - finalTamUng - totalDeductions;

        const historyData = {
          baseSalary: ins,
          totalBonus: totalBonus,
          totalDeduction: totalDeductions + finalTamUng,
          finalSalary: finalSalary,
          hoaHong: finalHoaHong,
          tamUng: finalTamUng,
          manualFines: finalManualFines,
          attendanceFines: finalAttendanceFines,
          halfDayDeduction: finalHalfDay,
          fullDayAbsenceDeduction: finalFullDay,
          workDays: finalWorkDays,
          workDates: finalWorkDates
        };

        // 6. NẾU CÓ RỒI -> UPDATE, NẾU CHƯA CÓ -> CREATE
        if (existingHistory) {
          await tx.salaryHistory.update({
            where: { id: existingHistory.id },
            data: historyData
          });
        } else {
          await tx.salaryHistory.create({
            data: {
              ...historyData,
              monthYear: monthYear,
              employeeId: emp.id
            }
          });
        }
      }

      // 7. RESET DỮ LIỆU THÔ VỪA ĐƯỢC CHỐT
      if (attIdsToDelete.length > 0) {
        await tx.attendanceRecord.deleteMany({ where: { id: { in: attIdsToDelete } } });
      }
      if (saleIdsToDelete.length > 0) {
        await tx.salesRecord.deleteMany({ where: { id: { in: saleIdsToDelete } } });
      }
    });

    getIO().emit("data_changed");
    res.status(200).json({ message: "Chốt lương thành công!" });
  } catch (error) {
    console.error("Lỗi khi chốt lương:", error);
    res.status(500).json({ error: "Lỗi hệ thống khi chốt lương" });
  }
};
export const getSalaryHistory = async (req: Request, res: Response) => {
  try {
    const history = await prisma.salaryHistory.findMany({
      include: {
        employee: {
          select: {id: true, name: true, employeeCode: true, department: true }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    res.json(history);
  } catch (error) {
    console.error("Lỗi lấy lịch sử lương:", error);
    res.status(500).json({ error: "Lỗi hệ thống khi lấy lịch sử lương" });
  }
};

// ==========================================
// 7. XỬ LÝ ĐƠN XIN NGHỈ PHÉP
// ==========================================
export const createLeaveRequest = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { type, startDate, endDate, reason } = req.body;

    const emp = await prisma.employee.findUnique({
      where: { id: id as string },
      include: { department: true }
    });

    if (!emp) return res.status(404).json({ error: "Không tìm thấy nhân viên" });

    const newRequest = await prisma.leaveRequest.create({
      data: {
        type, startDate, endDate, reason,
        employeeId: id as string,
        status: "Chờ duyệt"
      }
    });

    const saleManagers = await prisma.employee.findMany({
      where: {
        role: {
          contains: "Trưởng phòng",
          mode: "insensitive"
        },
        department: { 
          name: {
            contains: "Sale",
            mode: "insensitive"
          } 
        }
      },
      select: { name: true }
    });

    const managerNames = saleManagers.map(m => m.name.trim());
    const receivers = Array.from(new Set(["Giám đốc", "Admin", ...managerNames]));
    
    await prisma.notification.create({
      data: {
        sender: emp.name,
        message: `Nhân viên ${emp.name} (Phòng SALE) vừa gửi đơn xin ${type.toLowerCase()}.`,
        receiver: receivers,
      }
    });

    getIO().emit("new_notification", {
      message: `Có đơn mới từ ${emp.name}`,
      receivers: receivers
    });

    getIO().emit("data_changed");
    res.status(201).json(newRequest);
  } catch (error) {
    res.status(500).json({ error: "Lỗi hệ thống khi gửi đơn" });
  }
};

export const getLeaveRequests = async (req: Request, res: Response) => {
  try {
    const requests = await prisma.leaveRequest.findMany({
      include: {
        employee: {
          select: { name: true, department: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(requests);
  } catch (error) {
    res.status(500).json({ error: "Lỗi lấy danh sách nghỉ phép" });
  }
};

export const updateLeaveRequestStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const leaveRequest = await prisma.leaveRequest.findUnique({
      where: { id: id as string },
      include: { employee: true }
    });

    if (!leaveRequest) {
      return res.status(404).json({ error: "Không tìm thấy đơn xin nghỉ này!" });
    }

    if (status === "Đã duyệt" && leaveRequest.status !== "Đã duyệt") {
      if (leaveRequest.type === "Xin phép nghỉ" || leaveRequest.type === "Nửa ngày") {
        const baseSalary = leaveRequest.employee.baseSalary;
        const standardWorkDays = 22;
        const dailyWage = Math.round((baseSalary || 0) / standardWorkDays);

        let diffDays: number;
        if (leaveRequest.type === "Nửa ngày") {
          diffDays = 0.5;
        } else {
          const start = new Date(leaveRequest.startDate);
          const end = new Date(leaveRequest.endDate);
          const diffTime = Math.abs(end.getTime() - start.getTime());
          diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
        }

        const totalDeduction = Math.round(dailyWage * diffDays);

        // Dùng startDate của đơn nghỉ làm createdAt để phạt đúng tháng nghỉ
        const leaveCreatedAt = new Date(leaveRequest.startDate);

        await prisma.salesRecord.create({
          data: {
            employeeId: leaveRequest.employeeId,
            customer: "Hệ thống tự động",
            service: "Phạt",
            profit: -totalDeduction,
            note: `Trừ ${diffDays} ngày lương: Nghỉ phép từ ${leaveRequest.startDate} đến ${leaveRequest.endDate}`,
            createdAt: leaveCreatedAt,
          }
        });
      }
    }

    const updatedRequest = await prisma.leaveRequest.update({
      where: { id: id as string },
      data: { status }
    });

    getIO().emit("data_changed");

    res.json(updatedRequest);
  } catch (error) {
    console.error("Lỗi khi cập nhật trạng thái đơn nghỉ phép:", error);
    res.status(500).json({ error: "Lỗi hệ thống khi xử lý duyệt đơn" });
  }
};

export const getLeaveRequestsByEmployee = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const requests = await prisma.leaveRequest.findMany({
      where: { employeeId: id as string },
      orderBy: { createdAt: "desc" },
    });
    res.json(requests);
  } catch (error) {
    res.status(500).json({ error: "Lỗi lấy lịch sử nghỉ phép" });
  }
};