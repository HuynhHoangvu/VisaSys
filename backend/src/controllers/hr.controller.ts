import { Request, Response } from "express";
import { prisma } from "../../lib/prisma.js";
import { getIO } from "../socket.js";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";

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
// 1. TẢI PHIẾU LƯƠNG PDF
// ==========================================
export const downloadSalarySlip = async (req: Request, res: Response) => {
  let tmpJson: string | null = null;
  let tmpPdf: string | null = null;

  try {
    const { employeeId, monthYear } = req.params as { employeeId: string; monthYear: string };

    let scriptPath = path.join(process.cwd(), "src/scripts/gen_salary.py");
    if (!fs.existsSync(scriptPath)) {
      scriptPath = path.join(process.cwd(), "scripts/gen_salary.py");
    }
    if (!fs.existsSync(scriptPath)) {
      console.error("❌ Không tìm thấy script tại:", scriptPath);
      return res.status(500).json({ error: "Không tìm thấy file PDF generator" });
    }

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: { salesRecords: true, attendanceRecords: true },
    });
    if (!employee) return res.status(404).json({ error: "Không tìm thấy nhân viên" });

    let totalBonus = 0, manualFines = 0, salaryAdvances = 0, halfDayDeduction = 0;
    employee.salesRecords.forEach((r) => {
      const amount = Number(r.profit) || 0;
      if (r.service === "Phạt") manualFines += Math.abs(amount);
      else if (r.service === "Tạm ứng") salaryAdvances += Math.abs(amount);
      else totalBonus += amount;
    });

    const attendanceFines = employee.attendanceRecords.reduce((s, r) => s + (r.fine || 0), 0);
    halfDayDeduction = employee.attendanceRecords.reduce((s, r) => s + (r.halfDayDeduction || 0), 0);
    const workDays = employee.attendanceRecords.filter(
      (r) => r.outTime && r.outTime !== "-" && r.outTime !== "Quên checkout"
    ).length;

    const baseSalary = employee.baseSalary || 0;
    const bhxh = Math.round(baseSalary * 0.08);
    const bhyt = Math.round(baseSalary * 0.015);
    const bhtn = Math.round(baseSalary * 0.01);
    const thueTNCN = Math.round((baseSalary - bhxh - bhyt - bhtn) * 0.05);
    const finalSalary = baseSalary - salaryAdvances + totalBonus - (manualFines + attendanceFines + halfDayDeduction + bhxh + bhyt + bhtn + thueTNCN);

    const data = {
      employeeCode: employee.employeeCode,
      name: employee.name,
      role: employee.role,
      monthYear,
      baseSalary,
      totalBonus,
      workDays,
      thueTNCN,
      halfDayDeduction,
      otherDeduction: manualFines + attendanceFines,
      finalSalary,
    };

    const tmpDir = os.tmpdir();
    tmpJson = path.join(tmpDir, `salary_${employeeId}.json`);
    tmpPdf = path.join(tmpDir, `salary_${employeeId}.pdf`);
    fs.writeFileSync(tmpJson, JSON.stringify(data));

    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    try {
      execSync(`${pythonCmd} "${scriptPath}" "${tmpJson}" "${tmpPdf}"`, {
        encoding: "utf8",
        timeout: 30000,
      });
    } catch (pyError: any) {
      throw new Error("Python failed: " + (pyError.stderr || pyError.message));
    }

    const removeAccents = (str: string) =>
      str
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/Đ/g, "D")
        .replace(/[^\w\-\.]/g, '_'); 

    const safeName = removeAccents(employee.name.toLowerCase()).replace(/\s+/g, '_');
    const safeMonth = monthYear.replace("/", "_");
    const filename = `PhieuLuong_${safeName}_${safeMonth}.pdf`;
    const encodedFilename = encodeURIComponent(filename);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${encodedFilename}"; filename*=UTF-8''${encodedFilename}`
    );

    const pdfContent = fs.readFileSync(tmpPdf);
    res.send(pdfContent);

    if (tmpJson && fs.existsSync(tmpJson)) fs.unlinkSync(tmpJson);
    if (tmpPdf && fs.existsSync(tmpPdf)) fs.unlinkSync(tmpPdf);
  } catch (error) {
    if (tmpJson && fs.existsSync(tmpJson)) fs.unlinkSync(tmpJson);
    if (tmpPdf && fs.existsSync(tmpPdf)) fs.unlinkSync(tmpPdf);
    console.error("Lỗi tạo phiếu lương:", error);
    res.status(500).json({ error: "Lỗi tạo phiếu lương PDF" });
  }
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
// 4. CHECK-IN / CHECK-OUT (ĐÃ TÍCH HỢP KIỂM TRA ĐƠN PHÉP)
// ==========================================
export const checkInEmployee = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    let { date, inTime, outTime, status, fine } = req.body;

    // 1. Lấy ngày hiện tại theo chuẩn múi giờ VN
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

    // 2. Tìm xem nhân viên có đơn xin phép "Đã duyệt" hôm nay không
    const approvedLeave = await prisma.leaveRequest.findFirst({
      where: {
        employeeId: id as string,
        status: "Đã duyệt",
        startDate: { lte: todayISO },
        endDate: { gte: todayISO },
      }
    });

    // 3. Nếu có đơn được duyệt -> Miễn phạt hoàn toàn
    if (approvedLeave) {
      fine = 0; 
      if (status === "Đi muộn") {
        status = "Đi muộn (Có phép)"; 
      }
    }

    // 4. Lưu vào Database
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
    const outTime = now.toLocaleTimeString("vi-VN", { timeZone, hour: "2-digit", minute: "2-digit" });

    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone, hour: "numeric", minute: "numeric", year: "numeric", month: "2-digit", day: "2-digit", hour12: false
    });

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

    // Kiểm tra về sớm (trước 17:00 giờ VN)
    const outMinutes = vnHour * 60 + vnMinute;
    const isEarlyLeave = outMinutes < 17 * 60;

    let halfDayDeduction = 0;
    let newStatus = todayRecord.status;

    if (isEarlyLeave) {
      const todayISO = `${vnYear}-${vnMonth}-${vnDay}`; 
      
      // Kiểm tra đơn xin phép "Đã duyệt"
      const approvedLeave = await prisma.leaveRequest.findFirst({
        where: {
          employeeId: id,
          status: "Đã duyệt",
          startDate: { lte: todayISO },
          endDate: { gte: todayISO },
        },
      });

      if (!approvedLeave) {
        // KHÔNG CÓ PHÉP -> BỊ PHẠT NỬA NGÀY
        const employee = await prisma.employee.findUnique({ where: { id: id } });
        const workDays = getWorkDaysInMonth(parseInt(vnYear), parseInt(vnMonth) - 1); 
        halfDayDeduction = Math.round((employee!.baseSalary || 0) / workDays / 2);
        
        newStatus = todayRecord.status === "Đúng giờ" || todayRecord.status.includes("Có phép")
          ? "Về sớm"
          : `${todayRecord.status} + Về sớm`;
      } else {
        // CÓ PHÉP -> MIỄN PHẠT HOÀN TOÀN
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

      // Chỉ sinh ra SalesRecord phạt nếu bị trừ tiền thật sự
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
      },
      include: { employee: true },
    });

    for (const record of forgotRecords) {
      const workDays = getWorkDaysInMonth(now.getFullYear(), now.getMonth());
      const fullDayDeduction = Math.round(
        (record.employee.baseSalary || 0) / workDays
      );

      await prisma.$transaction(async (tx) => {
        await tx.attendanceRecord.update({
          where: { id: record.id },
          data: {
            outTime: "Quên checkout",
            status: "Quên checkout",
            halfDayDeduction: fullDayDeduction,
          },
        });

        await tx.salesRecord.create({
          data: {
            employeeId: record.employeeId,
            customer: "Hệ thống tự động",
            service: "Phạt",
            profit: -fullDayDeduction,
            note: `Quên check-out ngày ${todayStr} — mất 1 ngày công`,
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

    if (!monthYear) {
      return res.status(400).json({ error: "Vui lòng cung cấp tháng chốt lương!" });
    }

    const employees = await prisma.employee.findMany({
      include: {
        salesRecords: true,
        attendanceRecords: true,
      }
    });

    await prisma.$transaction(async (tx) => {
      for (const emp of employees) {
        let totalBonusAndCommission = 0;
        let manualFines = 0;
        let salaryAdvances = 0;

        emp.salesRecords.forEach((record) => {
          const amount = Number(record.profit) || 0;
          const type = record.service;

          if (type === "Phạt") {
            manualFines += Math.abs(amount);
          } else if (type === "Tạm ứng") {
            salaryAdvances += Math.abs(amount);
          } else {
            totalBonusAndCommission += amount;
          }
        });

        const attendanceFines = emp.attendanceRecords.reduce(
          (sum, r) => sum + (r.fine || 0),
          0
        );
        const halfDayDeductions = emp.attendanceRecords.reduce(
          (sum, r) => sum + (r.halfDayDeduction || 0),
          0
        );

        const totalDeductions = manualFines + attendanceFines + halfDayDeductions;
        const currentBaseSalary = (emp.baseSalary || 0) - salaryAdvances;
        const finalSalary = currentBaseSalary + totalBonusAndCommission - totalDeductions;

        await tx.salaryHistory.create({
          data: {
            monthYear: monthYear,
            baseSalary: emp.baseSalary || 0,
            totalBonus: totalBonusAndCommission,
            totalDeduction: totalDeductions + salaryAdvances,
            finalSalary: finalSalary,
            employeeId: emp.id
          }
        });
      }

      await tx.salesRecord.deleteMany({});
      await tx.attendanceRecord.deleteMany({});
    });

    getIO().emit("data_changed");
    res.status(200).json({ message: "Chốt lương và reset dữ liệu thành công!" });

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

    // 1. Tìm tất cả Trưởng phòng thuộc bộ phận SALE
    const saleManagers = await prisma.employee.findMany({
      where: {
        role: {
          contains: "Trưởng phòng", // Tìm chữ chứa "Trưởng phòng"
          mode: "insensitive"       // Bỏ qua phân biệt hoa/thường
        },
        department: { 
          name: {
            contains: "Sale",       // Tìm chữ chứa "Sale"
            mode: "insensitive"     // Bỏ qua phân biệt hoa/thường ("SALE", "Sale", "sale" đều dính)
          } 
        }
      },
      select: { name: true }
    });

    // 2. Gom danh sách người nhận (Admin + Giám đốc + Các trưởng phòng Sale)
    const managerNames = saleManagers.map(m => m.name);
    console.log("👉 Danh sách Trưởng phòng SALE tìm được:", managerNames);
    const receivers = Array.from(new Set(["Giám đốc", "Admin", ...managerNames]));
console.log("👉 Dữ liệu đẩy vào DB cột receiver:", receivers);
    // 3. Lưu vào bảng Notification
    await prisma.notification.create({
      data: {
        sender: emp.name,
        message: `Nhân viên ${emp.name} (Phòng SALE) vừa gửi đơn xin ${type.toLowerCase()}.`,
        receiver: receivers, // Đảm bảo cột receiver trong DB của bạn nhận mảng string
      }
    });

    // 4. Bắn Socket để hiện thông báo ngay lập tức
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

    const updatedRequest = await prisma.leaveRequest.update({
      where: { id: id as string },
      data: { status }
    });

    getIO().emit("data_changed");
    res.json(updatedRequest);
  } catch (error) {
    res.status(500).json({ error: "Lỗi cập nhật trạng thái đơn" });
  }
};