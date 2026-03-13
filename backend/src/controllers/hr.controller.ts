import { Request, Response } from "express";
import { prisma } from "../../lib/prisma.js";
import { getIO } from "../socket.js";

import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import os from "os"; // Thêm import os để xử lý thư mục tạm an toàn trên mọi HĐH

export const downloadSalarySlip = async (req: Request, res: Response) => {
  let tmpJson: string | null = null;
  let tmpPdf: string | null = null;

  try {
    const { employeeId, monthYear } = req.params as { employeeId: string; monthYear: string };

    // Tìm script Python
    let scriptPath = path.join(process.cwd(), "src/scripts/gen_salary.py");
    if (!fs.existsSync(scriptPath)) {
      scriptPath = path.join(process.cwd(), "scripts/gen_salary.py");
    }
    if (!fs.existsSync(scriptPath)) {
      console.error("❌ Không tìm thấy script tại:", scriptPath);
      return res.status(500).json({ error: "Không tìm thấy file PDF generator" });
    }

    // Lấy thông tin nhân viên
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: { salesRecords: true, attendanceRecords: true },
    });
    if (!employee) return res.status(404).json({ error: "Không tìm thấy nhân viên" });

    // Tính lương (giữ nguyên logic cũ)
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

    // Tạo file JSON tạm
    const tmpDir = os.tmpdir();
    tmpJson = path.join(tmpDir, `salary_${employeeId}.json`);
    tmpPdf = path.join(tmpDir, `salary_${employeeId}.pdf`);
    fs.writeFileSync(tmpJson, JSON.stringify(data));

    // Chạy script Python
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    try {
      const result = execSync(`${pythonCmd} "${scriptPath}" "${tmpJson}" "${tmpPdf}"`, {
        encoding: "utf8",
        timeout: 30000,
      });
      console.log("✅ Python OK:", result);
    } catch (pyError: any) {
      console.error("=== PYTHON ERROR ===");
      console.error("stderr:", pyError.stderr);
      console.error("stdout:", pyError.stdout);
      console.error("scriptPath:", scriptPath);
      throw new Error("Python failed: " + (pyError.stderr || pyError.message));
    }

    // --- Tạo tên file an toàn (chỉ ASCII, không dấu, không ký tự đặc biệt) ---
    const removeAccents = (str: string) =>
      str
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/Đ/g, "D")
        .replace(/[^\w\-\.]/g, '_'); // \w = [a-zA-Z0-9_]

    const safeName = removeAccents(employee.name.toLowerCase()).replace(/\s+/g, '_');
    const safeMonth = monthYear.replace("/", "_");
    const filename = `PhieuLuong_${safeName}_${safeMonth}.pdf`;

    // Mã hóa filename để đảm bảo không còn ký tự không hợp lệ trong header
    const encodedFilename = encodeURIComponent(filename);

    // Set header theo chuẩn RFC 5987 (hỗ trợ UTF-8)
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${encodedFilename}"; filename*=UTF-8''${encodedFilename}`
    );

    // Gửi file PDF
    const pdfContent = fs.readFileSync(tmpPdf);
    res.send(pdfContent);

    // Dọn dẹp file tạm
    if (tmpJson && fs.existsSync(tmpJson)) fs.unlinkSync(tmpJson);
    if (tmpPdf && fs.existsSync(tmpPdf)) fs.unlinkSync(tmpPdf);
  } catch (error) {
    // Dọn dẹp nếu có lỗi
    if (tmpJson && fs.existsSync(tmpJson)) fs.unlinkSync(tmpJson);
    if (tmpPdf && fs.existsSync(tmpPdf)) fs.unlinkSync(tmpPdf);

    console.error("Lỗi tạo phiếu lương:", error);
    res.status(500).json({ error: "Lỗi tạo phiếu lương PDF" });
  }
};

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
// 2. QUẢN LÝ NHÂN VIÊN (EMPLOYEE)
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

    // 1. Kiểm tra Email trùng
    const existingEmployee = await prisma.employee.findUnique({
      where: { email },
    });
    if (existingEmployee) {
      return res.status(400).json({ error: "Email này đã tồn tại trong hệ thống!" });
    }

    // 2. Lấy phòng ban
    const dept = await prisma.department.findFirst({ where: { name: department } });

    // ==========================================
    // 3. LOGIC TẠO MÃ NHÂN VIÊN MỚI (CHỐNG TRÙNG)
    // Lấy TẤT CẢ mã NV rồi tìm số LỚN NHẤT để tránh trùng
    // ==========================================
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
    // ==========================================

    // 4. Tạo nhân viên
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

export const checkInEmployee = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { date, inTime, outTime, status, fine } = req.body;

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
// 3. CHỐT LƯƠNG & RESET THÁNG MỚI (CHỈ GIÁM ĐỐC)
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

        const totalDeductions = manualFines + attendanceFines;
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

// ==========================================
// 4. XEM LỊCH SỬ LƯƠNG ĐÃ CHỐT
// ==========================================
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
// 5. XỬ LÝ ĐƠN XIN NGHỈ PHÉP & THÔNG BÁO
// ==========================================
export const createLeaveRequest = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { type, startDate, endDate, reason } = req.body;

    const emp = await prisma.employee.findUnique({
      where: { id: id as string }
    });

    if (!emp) {
      return res.status(404).json({ error: "Không tìm thấy nhân viên" });
    }

    const newRequest = await prisma.leaveRequest.create({
      data: {
        type,
        startDate,
        endDate,
        reason,
        employeeId: id as string,
        status: "Chờ duyệt"
      }
    });

    await prisma.notification.create({
      data: {
        sender: emp.name,
        message: `Nhân viên ${emp.name} vừa gửi đơn xin ${type.toLowerCase()}. Vui lòng kiểm tra và xét duyệt!`,
        receiver: ["Giám đốc", "Admin"],
      }
    });

    getIO().emit("data_changed");
    getIO().emit("new_notification");

    res.status(201).json(newRequest);
  } catch (error) {
    console.error("Lỗi tạo đơn nghỉ phép:", error);
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
export const updateEmployee = async (req: Request, res: Response) => {
  try {
    // Ép kiểu sang string ngay tại đây để dùng an toàn cho toàn bộ hàm
    const id = req.params.id as string; 
    const { name, email, password, department, role, baseSalary } = req.body;

    // 1. Kiểm tra email có bị trùng với người khác không
    const existingEmployee = await prisma.employee.findFirst({
      where: { 
        email, 
        id: { not: id } // Bây giờ id đã chuẩn là string, TypeScript sẽ không kêu ca nữa
      },
    });
    
    if (existingEmployee) {
      return res.status(400).json({ error: "Email này đã được sử dụng bởi nhân viên khác!" });
    }

    // 2. Tìm phòng ban
    const dept = await prisma.department.findFirst({ where: { name: department } });

    // 3. Chuẩn bị dữ liệu cập nhật
    const updateData: any = {
      name,
      email,
      role,
      departmentId: dept?.id || null,
      baseSalary: baseSalary ? parseFloat(baseSalary) : 5000000,
      commissionRate: role === "Trưởng phòng" ? 0.15 : (role.includes("Sale") ? 0.1 : 0)
    };

    // Nếu có truyền password mới thì mới cập nhật password
    if (password && password.trim() !== "") {
      updateData.password = password;
    }

    // 4. Update
    const updatedEmployee = await prisma.employee.update({
      where: { id }, // Không cần "id as string" ở đây nữa vì đã ép kiểu ở trên
      data: updateData,
    });

    getIO().emit("data_changed");
    res.json(updatedEmployee);
  } catch (error) {
    console.error("Lỗi cập nhật nhân viên:", error);
    res.status(500).json({ error: "Lỗi Server khi cập nhật nhân viên" });
  }
};
// ==========================================
// 6. CHECK-OUT & TÍNH NGÀY CÔNG
// ==========================================

// Helper: tính số ngày làm việc T2-T6 trong tháng
const getWorkDaysInMonth = (year: number, month: number): number => {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  let count = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const day = new Date(year, month, d).getDay();
    if (day !== 0 && day !== 6) count++;
  }
  return count;
};

export const checkOutEmployee = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const now = new Date();
    
    // 1. Cố định múi giờ Việt Nam (GMT+7)
    const timeZone = "Asia/Ho_Chi_Minh";

    // Format ngày giờ hiển thị theo chuẩn VN
    const todayStr = now.toLocaleDateString("vi-VN", { timeZone });
    const outTime = now.toLocaleTimeString("vi-VN", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
    });

    // Tách các thành phần thời gian (Giờ, Phút, Năm, Tháng, Ngày) chuẩn theo giờ VN
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "numeric",
      minute: "numeric",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour12: false, // Sử dụng định dạng 24h
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

    // 2. Tìm record check-in hôm nay
    const todayRecord = await prisma.attendanceRecord.findFirst({
      where: { employeeId: id, date: todayStr },
    });

    if (!todayRecord) {
      return res.status(400).json({ error: "Chưa check-in hôm nay!" });
    }
    if (todayRecord.outTime && todayRecord.outTime !== "-") {
      return res.status(400).json({ error: "Đã check-out rồi!" });
    }

    // 3. Kiểm tra về sớm (trước 17:00 giờ Việt Nam)
    const outMinutes = vnHour * 60 + vnMinute;
    const isEarlyLeave = outMinutes < 17 * 60;

    // 4. Nếu về sớm → kiểm tra có đơn nghỉ phép được duyệt hôm nay không
    let halfDayDeduction = 0;
    let newStatus = todayRecord.status;

    if (isEarlyLeave) {
      // Ép ngày ISO theo múi giờ VN (YYYY-MM-DD) thay vì .toISOString() mặc định của UTC
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
        // Tính nửa ngày lương
        const employee = await prisma.employee.findUnique({ where: { id: id } });
        // Truyền đúng tháng, năm đã được ép kiểu (tháng của JS bắt đầu từ 0 nên cần trừ 1)
        const workDays = getWorkDaysInMonth(parseInt(vnYear), parseInt(vnMonth) - 1); 
        halfDayDeduction = Math.round((employee!.baseSalary || 0) / workDays / 2);
        
        newStatus = todayRecord.status === "Đúng giờ"
          ? "Về sớm"
          : `${todayRecord.status} + Về sớm`;
      }
    }

    // 5. Update record checkout trong transaction
    await prisma.$transaction(async (tx) => {
      await tx.attendanceRecord.update({
        where: { id: todayRecord.id },
        data: {
          outTime,
          status: newStatus,
          halfDayDeduction,
        },
      });

      // Lưu khoản trừ vào salesRecord nếu về sớm không phép
      if (halfDayDeduction > 0) {
        await tx.salesRecord.create({
          data: {
            employeeId: id,
            customer: "Hệ thống tự động",
            service: "Phạt",
            profit: -halfDayDeduction,
            note: `Về sớm ngày ${todayStr} (chưa được duyệt phép)`,
          },
        });
      }
    });

    getIO().emit("data_changed");
    res.json({ success: true, isEarlyLeave, halfDayDeduction, outTime });
  } catch (error) {
    console.error("Lỗi check-out:", error);
    res.status(500).json({ error: "Lỗi hệ thống khi check-out" });
  }
};

// ==========================================
// 7. CRON JOB: PHẠT QUÊN CHECK-OUT (gọi mỗi đêm lúc 23:59)
// ==========================================
export const penalizeForgotCheckout = async (req: Request, res: Response) => {
  try {
    const now = new Date();
    const todayStr = now.toLocaleDateString("vi-VN");

    // Tìm tất cả record hôm nay chưa checkout
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