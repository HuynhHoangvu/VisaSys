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

    // Lọc theo tháng (monthYear = "MM/YYYY")
    const [mm, yyyy] = monthYear.split('/');
    const monthAttendance = employee.attendanceRecords.filter((r) => {
      const parts = r.date ? r.date.split('/') : [];
      return parts.length === 3 && parts[1] === mm && parts[2] === yyyy;
    });
    const monthSales = employee.salesRecords.filter((r) => {
      if (!r.createdAt) return true;
      const d = new Date(r.createdAt);
      return d.getMonth() + 1 === parseInt(mm) && d.getFullYear() === parseInt(yyyy);
    });

    let hoaHong = 0, manualFines = 0, salaryAdvances = 0;
    monthSales.forEach((r) => {
      const amount = Number(r.profit) || 0;
      if (r.service === "Phạt") manualFines += Math.abs(amount);
      else if (r.service === "Tạm ứng") salaryAdvances += Math.abs(amount);
      else if (!["Chuyên cần", "Ăn trưa", "Hỗ trợ khác"].includes(r.service || ""))
        hoaHong += amount;
    });

    const attendanceFines = monthAttendance.reduce((s, r) => s + (r.fine || 0), 0);
    
    // Tính trừ lương vắng không phép (1 ngày đầy đủ)
    const fullDayAbsenceDeduction = monthAttendance.reduce((s, r) => {
      if (r.status === "Vắng không phép") {
        return s + Math.round(insuranceSalary / 21); // 1 ngày lương
      }
      return s;
    }, 0);
    
    // Tính trừ lương nửa ngày
    const halfDayDeduction = monthAttendance.reduce((s, r) => s + (r.halfDayDeduction || 0), 0);
    
    // Tổng trừ lương (cả ngày + nửa ngày)
    const totalAbsenceDeduction = fullDayAbsenceDeduction + halfDayDeduction;
    const checkedOutRecords = monthAttendance.filter(
      (r) => r.outTime && r.outTime !== "-" && r.outTime !== "Quên checkout"
    );
    const workDays = checkedOutRecords.length;
    const workDates = checkedOutRecords.map((r) => r.date).sort();
    
    // Chi tiết các ngày đi trễ (halfDayDeduction > 0)
    const lateRecords = monthAttendance.filter((r) => (r.halfDayDeduction || 0) > 0).map((r) => ({
      date: r.date,
      amount: r.halfDayDeduction,
      status: r.status,
    }));
    
    // Chi tiết phạt đi trễ (fine > 0)
    const fineRecords = monthAttendance.filter((r) => (r.fine || 0) > 0).map((r) => ({
      date: r.date,
      amount: r.fine,
      status: r.status,
    }));
    
    // Chi tiết các lần ứng lương (tạm ứng)
    const advanceRecords = monthSales.filter((r) => r.service === "Tạm ứng").map((r) => ({
      date: r.createdAt ? new Date(r.createdAt).toLocaleDateString('vi-VN') : '',
      amount: Math.abs(Number(r.profit) || 0),
      note: r.note || '',
    }));
    
    // Chi tiết các ngày vắng không phép (cả ngày)
    const absenceRecords = monthAttendance.filter((r) => r.status === "Vắng không phép").map((r) => ({
      date: r.date,
      amount: Math.round(insuranceSalary / 21),  // 1 ngày lương
      status: r.status,
    }));

    // Tách lương: >= 8tr → lương CB = tổng - 2tr, phụ cấp 2tr
    const totalSalary = employee.baseSalary || 0;
    const THRESHOLD = 8_000_000;
    const insuranceSalary = totalSalary >= THRESHOLD ? totalSalary - 2_000_000 : totalSalary;
    const chuyenCan = totalSalary >= THRESHOLD ? 1_000_000 : 0;
    const anTrua    = totalSalary >= THRESHOLD ?   500_000 : 0;
    const hoTroKhac = totalSalary >= THRESHOLD ?   500_000 : 0;

    const bhxh = Math.round(insuranceSalary * 0.08);
    const bhyt = Math.round(insuranceSalary * 0.015);
    const bhtn = Math.round(insuranceSalary * 0.01);
    const bhxhCty = Math.round(insuranceSalary * 0.175);
    const bhytCty = Math.round(insuranceSalary * 0.03);
    const bhtnCty = Math.round(insuranceSalary * 0.01);
    const totalIncome = insuranceSalary + chuyenCan + anTrua + hoTroKhac + hoaHong;
    const finalSalary = totalIncome - salaryAdvances - manualFines - attendanceFines - totalAbsenceDeduction - bhxh - bhyt - bhtn;

    const data = {
      employeeCode: employee.employeeCode,
      name: employee.name,
      role: employee.role,
      monthYear,
      baseSalary: insuranceSalary,
      chuyenCan,
      anTrua,
      hoTroKhac,
      hoaHong,
      insuranceSalary,
      workDays,
      workDates,
      tamUng: salaryAdvances,
      fullDayAbsenceDeduction,
      halfDayDeduction,
      attendanceFines,
      manualFines,
      bhxhCty,
      bhytCty,
      bhtnCty,
      bhxhNld: bhxh,
      bhytNld: bhyt,
      bhtnNld: bhtn,
      finalSalary,
      lateRecords,
      fineRecords,
      advanceRecords,
      absenceRecords,
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
// 1b. TẢI BẢNG LƯƠNG TỔNG PDF
// ==========================================
export const downloadSalarySummary = async (req: Request, res: Response) => {
  let tmpJson: string | null = null;
  let tmpPdf: string | null = null;

  try {
    const { monthYear } = req.params as { monthYear: string };

    let scriptPath = path.join(process.cwd(), "src/scripts/gen_salary.py");
    if (!fs.existsSync(scriptPath)) {
      scriptPath = path.join(process.cwd(), "scripts/gen_salary.py");
    }
    if (!fs.existsSync(scriptPath)) {
      return res.status(500).json({ error: "Không tìm thấy file PDF generator" });
    }

    const employees = await prisma.employee.findMany({
      include: { salesRecords: true, attendanceRecords: true },
      orderBy: { name: "asc" },
    });

    const [smm, syyyy] = monthYear.split('/');
    const THRESHOLD = 8_000_000;

    const employeeData = employees.map((emp) => {
      // Lọc theo tháng
      const monthAtt = emp.attendanceRecords.filter((r) => {
        const parts = r.date ? r.date.split('/') : [];
        return parts.length === 3 && parts[1] === smm && parts[2] === syyyy;
      });
      const monthSales = emp.salesRecords.filter((r) => {
        if (!r.createdAt) return true;
        const d = new Date(r.createdAt);
        return d.getMonth() + 1 === parseInt(smm) && d.getFullYear() === parseInt(syyyy);
      });

      let hoaHong = 0, tamUng = 0, manualFines = 0;
      monthSales.forEach((r) => {
        const amount = Number(r.profit) || 0;
        if (r.service === "Phạt") manualFines += Math.abs(amount);
        else if (r.service === "Tạm ứng") tamUng += Math.abs(amount);
        else if (!["Chuyên cần", "Ăn trưa", "Hỗ trợ khác"].includes(r.service || ""))
          hoaHong += amount;
      });

      const attendanceFines = monthAtt.reduce((s, r) => s + (r.fine || 0), 0);
      const halfDayDeduction = monthAtt.reduce((s, r) => s + (r.halfDayDeduction || 0), 0);
      const workDays = monthAtt.filter(
        (r) => r.outTime && r.outTime !== "-" && r.outTime !== "Quên checkout"
      ).length;

      // Tách lương theo mốc
      const totalSalaryBrutto = emp.baseSalary || 0;
      const ins = totalSalaryBrutto >= THRESHOLD ? totalSalaryBrutto - 2_000_000 : totalSalaryBrutto;
      const cc  = totalSalaryBrutto >= THRESHOLD ? 1_000_000 : 0;
      const at  = totalSalaryBrutto >= THRESHOLD ?   500_000 : 0;
      const htk = totalSalaryBrutto >= THRESHOLD ?   500_000 : 0;
      const totalBonus = cc + at + htk + hoaHong;
      const totalSalary = ins + totalBonus;

      const bhxhCty  = Math.round(ins * 0.175);
      const bhytCty  = Math.round(ins * 0.03);
      const bhtnCty  = Math.round(ins * 0.01);
      const totalCty = bhxhCty + bhytCty + bhtnCty;

      const bhxhNld  = Math.round(ins * 0.08);
      const bhytNld  = Math.round(ins * 0.015);
      const bhtnNld  = Math.round(ins * 0.01);
      const totalNld = bhxhNld + bhytNld + bhtnNld;

      const finalSalary = totalSalary - tamUng - manualFines - attendanceFines - halfDayDeduction - bhxhNld - bhytNld - bhtnNld;

      return {
        name: emp.name,
        role: emp.role || "",
        baseSalary: ins,
        chuyenCan: cc,
        anTrua: at,
        hoTroKhac: htk,
        hoaHong,
        totalBonus,
        workDays,
        totalSalary,
        insuranceSalary: ins,
        bhxhCty, bhytCty, bhtnCty, totalCty,
        bhxhNld, bhytNld, bhtnNld, totalNld,
        tamUng,
        halfDayDeduction,
        finalSalary,
      };
    });

    const summaryData = { monthYear, employees: employeeData };

    const tmpDir = os.tmpdir();
    const ts = Date.now();
    tmpJson = path.join(tmpDir, `salary_summary_${ts}.json`);
    tmpPdf  = path.join(tmpDir, `salary_summary_${ts}.pdf`);
    fs.writeFileSync(tmpJson, JSON.stringify(summaryData, null, 2), "utf8");

    const pythonCmd = process.platform === "win32" ? "python" : "python3";
    try {
      execSync(`${pythonCmd} "${scriptPath}" summary "${tmpJson}" "${tmpPdf}"`, {
        encoding: "utf8",
        timeout: 30000,
      });
    } catch (pyError: any) {
      throw new Error("Python failed: " + (pyError.stderr || pyError.message));
    }

    const safeMonth = monthYear.replace("/", "_");
    const filename = `BangLuong_${safeMonth}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(fs.readFileSync(tmpPdf));

    if (tmpJson && fs.existsSync(tmpJson)) fs.unlinkSync(tmpJson);
    if (tmpPdf && fs.existsSync(tmpPdf)) fs.unlinkSync(tmpPdf);
  } catch (error) {
    if (tmpJson && fs.existsSync(tmpJson)) fs.unlinkSync(tmpJson);
    if (tmpPdf && fs.existsSync(tmpPdf)) fs.unlinkSync(tmpPdf);
    console.error("Lỗi tạo bảng lương tổng:", error);
    res.status(500).json({ error: "Lỗi tạo bảng lương tổng PDF" });
  }
};

// ==========================================
// 1c. TẢI BẢNG LƯƠNG TỔNG EXCEL (MỚI THÊM)
// ==========================================
// Helper: tính data lương theo tháng cho từng nhân viên
function buildEmployeePayrollData(employees: any[], monthYear: string, threshold = 8_000_000) {
  const [mm, yyyy] = monthYear.split('/');
  return employees.map((emp) => {
    const monthAtt = emp.attendanceRecords.filter((r: any) => {
      const parts = r.date ? r.date.split('/') : [];
      return parts.length === 3 && parts[1] === mm && parts[2] === yyyy;
    });
    const monthSales = emp.salesRecords.filter((r: any) => {
      if (!r.createdAt) return true;
      const d = new Date(r.createdAt);
      return d.getMonth() + 1 === parseInt(mm) && d.getFullYear() === parseInt(yyyy);
    });

    let hoaHong = 0, tamUng = 0, manualFines = 0;
    monthSales.forEach((r: any) => {
      const amount = Number(r.profit) || 0;
      if (r.service === "Phạt") manualFines += Math.abs(amount);
      else if (r.service === "Tạm ứng") tamUng += Math.abs(amount);
      else if (!["Chuyên cần", "Ăn trưa", "Hỗ trợ khác"].includes(r.service || ""))
        hoaHong += amount;
    });

    const attendanceFines = monthAtt.reduce((s: number, r: any) => s + (r.fine || 0), 0);
    const halfDayDeduction = monthAtt.reduce((s: number, r: any) => s + (r.halfDayDeduction || 0), 0);
    const workDays = monthAtt.filter(
      (r: any) => r.outTime && r.outTime !== "-" && r.outTime !== "Quên checkout"
    ).length;

    // Chi tiết các ngày đi trễ (halfDayDeduction > 0)
    const lateRecords = monthAtt.filter((r: any) => (r.halfDayDeduction || 0) > 0).map((r: any) => ({
      date: r.date,
      amount: r.halfDayDeduction,
      status: r.status,
    }));
    
    // Chi tiết phạt đi trễ (fine > 0)
    const fineRecords = monthAtt.filter((r: any) => (r.fine || 0) > 0).map((r: any) => ({
      date: r.date,
      amount: r.fine,
      status: r.status,
    }));
    
    // Chi tiết các lần ứng lương (tạm ứng)
    const advanceRecords = monthSales.filter((r: any) => r.service === "Tạm ứng").map((r: any) => ({
      date: r.createdAt ? new Date(r.createdAt).toLocaleDateString('vi-VN') : '',
      amount: Math.abs(Number(r.profit) || 0),
      note: r.note || '',
    }));
    
    // Chi tiết các ngày vắng không phép (cả ngày)
    const absenceRecords = monthAtt.filter((r: any) => r.status === "Vắng không phép").map((r: any) => ({
      date: r.date,
      amount: Math.round(ins / 21),  // 1 ngày lương
      status: r.status,
    }));

    const totalSalaryBrutto = emp.baseSalary || 0;
    const ins = totalSalaryBrutto >= threshold ? totalSalaryBrutto - 2_000_000 : totalSalaryBrutto;
    
    // Tính trừ lương vắng không phép (1 ngày đầy đủ)
    const fullDayAbsenceDeduction = monthAtt.reduce((s: number, r: any) => {
      if (r.status === "Vắng không phép") {
        return s + Math.round(ins / 21); // 1 ngày lương
      }
      return s;
    }, 0);
    
    // Tổng trừ lương (cả ngày + nửa ngày)
    const totalAbsenceDeduction = fullDayAbsenceDeduction + halfDayDeduction;
    const cc  = totalSalaryBrutto >= threshold ? 1_000_000 : 0;
    const at  = totalSalaryBrutto >= threshold ?   500_000 : 0;
    const htk = totalSalaryBrutto >= threshold ?   500_000 : 0;
    const totalBonus = cc + at + htk + hoaHong;
    const totalSalary = ins + totalBonus;

    const bhxhCty  = Math.round(ins * 0.175);
    const bhytCty  = Math.round(ins * 0.03);
    const bhtnCty  = Math.round(ins * 0.01);
    const totalCty = bhxhCty + bhytCty + bhtnCty;
    const bhxhNld  = Math.round(ins * 0.08);
    const bhytNld  = Math.round(ins * 0.015);
    const bhtnNld  = Math.round(ins * 0.01);
    const totalNld = bhxhNld + bhytNld + bhtnNld;

    const finalSalary = totalSalary - tamUng - manualFines - attendanceFines - totalAbsenceDeduction - bhxhNld - bhytNld - bhtnNld;

    return {
      employeeCode: emp.employeeCode || "",
      name: emp.name,
      role: emp.role || "",
      baseSalary: ins,
      chuyenCan: cc,
      anTrua: at,
      hoTroKhac: htk,
      hoaHong,
      totalBonus,
      workDays,
      totalSalary,
      insuranceSalary: ins,
      bhxhCty, bhytCty, bhtnCty, totalCty,
      bhxhNld, bhytNld, bhtnNld, totalNld,
      tamUng,
      fullDayAbsenceDeduction,
      halfDayDeduction,
      attendanceFines,
      manualFines,
      finalSalary,
      lateRecords,
      fineRecords,
      advanceRecords,
      absenceRecords,
    };
  });
}

// ==========================================
// 1c. TẢI BẢNG LƯƠNG TỔNG EXCEL
// ==========================================
export const downloadSalarySummaryExcel = async (req: Request, res: Response) => {
  let tmpJson: string | null = null;
  let tmpXlsx: string | null = null;
  try {
    const { monthYear } = req.params as { monthYear: string };
    let scriptPath = path.join(process.cwd(), "src/scripts/gen_salary.py");
    if (!fs.existsSync(scriptPath)) scriptPath = path.join(process.cwd(), "scripts/gen_salary.py");
    if (!fs.existsSync(scriptPath)) return res.status(500).json({ error: "Không tìm thấy file Python generator" });

    const employees = await prisma.employee.findMany({
      include: { salesRecords: true, attendanceRecords: true },
      orderBy: { name: "asc" },
    });

    const summaryData = { monthYear, employees: buildEmployeePayrollData(employees, monthYear) };
    const tmpDir = os.tmpdir();
    const ts = Date.now();
    tmpJson = path.join(tmpDir, `salary_excel_${ts}.json`);
    tmpXlsx = path.join(tmpDir, `salary_excel_${ts}.xlsx`);
    fs.writeFileSync(tmpJson, JSON.stringify(summaryData, null, 2), "utf8");

    const pythonCmd = process.platform === "win32" ? "python" : "python3";
    execSync(`${pythonCmd} "${scriptPath}" excel "${tmpJson}" "${tmpXlsx}"`, { encoding: "utf8", timeout: 30000 });

    const filename = `BangLuong_${monthYear.replace("/", "_")}.xlsx`;
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(fs.readFileSync(tmpXlsx));
    if (tmpJson && fs.existsSync(tmpJson)) fs.unlinkSync(tmpJson);
    if (tmpXlsx && fs.existsSync(tmpXlsx)) fs.unlinkSync(tmpXlsx);
  } catch (error) {
    if (tmpJson && fs.existsSync(tmpJson)) fs.unlinkSync(tmpJson);
    if (tmpXlsx && fs.existsSync(tmpXlsx)) fs.unlinkSync(tmpXlsx);
    console.error("Lỗi tạo bảng lương tổng Excel:", error);
    res.status(500).json({ error: "Lỗi tạo bảng lương tổng Excel" });
  }
};

// ==========================================
// 1d. TẢI PHIẾU LƯƠNG CÁ NHÂN EXCEL (mỗi người 1 sheet)
// ==========================================
export const downloadSalarySlipsExcel = async (req: Request, res: Response) => {
  let tmpJson: string | null = null;
  let tmpXlsx: string | null = null;
  try {
    const { monthYear } = req.params as { monthYear: string };
    let scriptPath = path.join(process.cwd(), "src/scripts/gen_salary.py");
    if (!fs.existsSync(scriptPath)) scriptPath = path.join(process.cwd(), "scripts/gen_salary.py");
    if (!fs.existsSync(scriptPath)) return res.status(500).json({ error: "Không tìm thấy file Python generator" });

    const employees = await prisma.employee.findMany({
      include: { salesRecords: true, attendanceRecords: true },
      orderBy: { name: "asc" },
    });

    const summaryData = { monthYear, employees: buildEmployeePayrollData(employees, monthYear) };
    const tmpDir = os.tmpdir();
    const ts = Date.now();
    tmpJson = path.join(tmpDir, `salary_slips_${ts}.json`);
    tmpXlsx = path.join(tmpDir, `salary_slips_${ts}.xlsx`);
    fs.writeFileSync(tmpJson, JSON.stringify(summaryData, null, 2), "utf8");

    const pythonCmd = process.platform === "win32" ? "python" : "python3";
    execSync(`${pythonCmd} "${scriptPath}" slips "${tmpJson}" "${tmpXlsx}"`, { encoding: "utf8", timeout: 30000 });

    const filename = `PhieuLuong_${monthYear.replace("/", "_")}.xlsx`;
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(fs.readFileSync(tmpXlsx));
    if (tmpJson && fs.existsSync(tmpJson)) fs.unlinkSync(tmpJson);
    if (tmpXlsx && fs.existsSync(tmpXlsx)) fs.unlinkSync(tmpXlsx);
  } catch (error) {
    if (tmpJson && fs.existsSync(tmpJson)) fs.unlinkSync(tmpJson);
    if (tmpXlsx && fs.existsSync(tmpXlsx)) fs.unlinkSync(tmpXlsx);
    console.error("Lỗi tạo phiếu lương Excel:", error);
    res.status(500).json({ error: "Lỗi tạo phiếu lương Excel" });
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

        await prisma.salesRecord.create({
          data: {
            employeeId: leaveRequest.employeeId,
            customer: "Hệ thống tự động",
            service: "Phạt",
            profit: -totalDeduction,
            note: `Trừ ${diffDays} ngày lương: Nghỉ phép từ ${leaveRequest.startDate} đến ${leaveRequest.endDate}`,
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