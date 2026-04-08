import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
import { Request, Response } from "express";
import { prisma } from "../../lib/prisma.js";
import { getIO } from "../socket.js";

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
      return res.status(500).json({ error: "Không tìm thấy file PDF generator" });
    }

    // 1. ƯU TIÊN TÌM TRONG LỊCH SỬ CHỐT LƯƠNG
    const historyRecord = await prisma.salaryHistory.findFirst({
      where: { employeeId, monthYear },
      include: { employee: true }
    });

    let data: any = {};

    if (historyRecord) {
      // NẾU THÁNG ĐÃ CHỐT: Bê y nguyên số liệu từ Lịch sử ra
      const ins = historyRecord.baseSalary;
      const threshold = 8_000_000;
      const cc  = ins >= (threshold - 2_000_000) ? 1_000_000 : 0;
      const at  = ins >= (threshold - 2_000_000) ?   500_000 : 0;
      const htk = ins >= (threshold - 2_000_000) ?   500_000 : 0;

      data = {
        employeeCode: historyRecord.employee?.employeeCode || "",
        name: historyRecord.employee?.name || "Nhân viên",
        role: historyRecord.employee?.role || "",
        monthYear,
        baseSalary: ins,
        chuyenCan: cc,
        anTrua: at,
        hoTroKhac: htk,
        hoaHong: historyRecord.hoaHong || 0,
        insuranceSalary: ins,
        workDays: historyRecord.workDays || 0,
        workDates: historyRecord.workDates || [],
        tamUng: historyRecord.tamUng || 0,
        fullDayAbsenceDeduction: historyRecord.fullDayAbsenceDeduction || 0,
        halfDayDeduction: historyRecord.halfDayDeduction || 0,
        attendanceFines: historyRecord.attendanceFines || 0,
        manualFines: historyRecord.manualFines || 0,
        bhxhNld: Math.round(ins * 0.08),
        bhytNld: Math.round(ins * 0.015),
        bhtnNld: Math.round(ins * 0.01),
        finalSalary: historyRecord.finalSalary || 0,
      };
    } else {
      // NẾU THÁNG CHƯA CHỐT: Tính toán trực tiếp (Live)
      const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
        include: { salesRecords: true, attendanceRecords: true },
      });
      if (!employee) return res.status(404).json({ error: "Không tìm thấy nhân viên" });

      const [mm, yyyy] = monthYear.split('/');
      const monthAttendance = employee.attendanceRecords.filter((r) => {
        const parts = r.date ? r.date.split('/') : [];
        return parts.length === 3 && parseInt(parts[1]) === parseInt(mm) && parseInt(parts[2]) === parseInt(yyyy);
      });
      const monthSales = employee.salesRecords.filter((r) => {
        if (!r.createdAt) return true;
        const d = new Date(r.createdAt);
        return d.getMonth() + 1 === parseInt(mm) && d.getFullYear() === parseInt(yyyy);
      });

      const totalSalaryBrutto = employee.baseSalary || 0;
      const THRESHOLD = 8_000_000;
      const insuranceSalary = totalSalaryBrutto >= THRESHOLD ? totalSalaryBrutto - 2_000_000 : totalSalaryBrutto;
      const chuyenCan = totalSalaryBrutto >= THRESHOLD ? 1_000_000 : 0;
      const anTrua    = totalSalaryBrutto >= THRESHOLD ?   500_000 : 0;
      const hoTroKhac = totalSalaryBrutto >= THRESHOLD ?   500_000 : 0;

      let hoaHong = 0, manualFines = 0, salaryAdvances = 0;
      monthSales.forEach((r) => {
        const amount = Number(r.profit) || 0;
        if (r.service === "Phạt") manualFines += Math.abs(amount);
        else if (r.service === "Tạm ứng") salaryAdvances += Math.abs(amount);
        else if (!["Chuyên cần", "Ăn trưa", "Hỗ trợ khác"].includes(r.service || ""))
          hoaHong += amount;
      });

      const attendanceFines = monthAttendance.reduce((s, r) => s + (r.fine || 0), 0);
      const fullDayAbsenceDeduction = monthAttendance.reduce((s, r) => {
        if (r.status === "Vắng không phép") return s + Math.round(insuranceSalary / 21);
        return s;
      }, 0);
      const halfDayDeduction = monthAttendance.reduce((s, r) => s + (r.halfDayDeduction || 0), 0);

      const checkedOutRecords = monthAttendance.filter((r) => r.outTime && r.outTime !== "-" && r.outTime !== "Quên checkout");
      const workDays = checkedOutRecords.length;
      const workDates = checkedOutRecords.map((r) => r.date).sort();

      const bhxh = Math.round(insuranceSalary * 0.08);
      const bhyt = Math.round(insuranceSalary * 0.015);
      const bhtn = Math.round(insuranceSalary * 0.01);
      
      const totalIncome = insuranceSalary + chuyenCan + anTrua + hoTroKhac + hoaHong;
      const finalSalary = totalIncome - salaryAdvances - manualFines - attendanceFines - fullDayAbsenceDeduction - halfDayDeduction - bhxh - bhyt - bhtn;

      data = {
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
        bhxhNld: bhxh,
        bhytNld: bhyt,
        bhtnNld: bhtn,
        finalSalary,
      };
    }

    const tmpDir = os.tmpdir();
    tmpJson = path.join(tmpDir, `salary_${employeeId}.json`);
    tmpPdf = path.join(tmpDir, `salary_${employeeId}.pdf`);
    fs.writeFileSync(tmpJson, JSON.stringify(data));

    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    execSync(`${pythonCmd} "${scriptPath}" "${tmpJson}" "${tmpPdf}"`, {
      encoding: "utf8",
      timeout: 30000,
    });

    const safeName = data.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").replace(/[^\w\-\.]/g, '_').toLowerCase();
    const safeMonth = monthYear.replace("/", "_");
    const filename = `PhieuLuong_${safeName}_${safeMonth}.pdf`;
    const encodedFilename = encodeURIComponent(filename);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${encodedFilename}"; filename*=UTF-8''${encodedFilename}`);

    res.send(fs.readFileSync(tmpPdf));

    if (fs.existsSync(tmpJson)) fs.unlinkSync(tmpJson);
    if (fs.existsSync(tmpPdf)) fs.unlinkSync(tmpPdf);
  } catch (error) {
    console.error("Lỗi tạo phiếu lương:", error);
    res.status(500).json({ error: "Lỗi tạo phiếu lương PDF" });
  }
};

// ==========================================
// 1a-DEBUG: Test lấy dữ liệu tính lương (JSON - không PDF)
// ==========================================
export const testSalaryCalculation = async (req: Request, res: Response) => {
  try {
    const { employeeId, monthYear } = req.params as { employeeId: string; monthYear: string };

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: { salesRecords: true, attendanceRecords: true },
    });
    if (!employee) return res.status(404).json({ error: "Không tìm thấy nhân viên" });

    // Lọc theo tháng (monthYear = "MM/YYYY")
    const [mm, yyyy] = monthYear.split('/');
    const monthAttendance = employee.attendanceRecords.filter((r) => {
      const parts = r.date ? r.date.split('/') : [];
      return parts.length === 3 && parseInt(parts[1]) === parseInt(mm) && parseInt(parts[2]) === parseInt(yyyy);
    });
    const monthSales = employee.salesRecords.filter((r) => {
      if (!r.createdAt) return true;
      const d = new Date(r.createdAt);
      return d.getMonth() + 1 === parseInt(mm) && d.getFullYear() === parseInt(yyyy);
    });

    // Tách lương: >= 8tr → lương CB = tổng - 2tr, phụ cấp 2tr
    const totalSalary = employee.baseSalary || 0;
    const THRESHOLD = 8_000_000;
    const insuranceSalary = totalSalary >= THRESHOLD ? totalSalary - 2_000_000 : totalSalary;
    const chuyenCan = totalSalary >= THRESHOLD ? 1_000_000 : 0;
    const anTrua    = totalSalary >= THRESHOLD ?   500_000 : 0;
    const hoTroKhac = totalSalary >= THRESHOLD ?   500_000 : 0;

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

    const bhxh = Math.round(insuranceSalary * 0.08);
    const bhyt = Math.round(insuranceSalary * 0.015);
    const bhtn = Math.round(insuranceSalary * 0.01);
    const bhxhCty = Math.round(insuranceSalary * 0.175);
    const bhytCty = Math.round(insuranceSalary * 0.03);
    const bhtnCty = Math.round(insuranceSalary * 0.01);
    const totalIncome = insuranceSalary + chuyenCan + anTrua + hoTroKhac + hoaHong;
    const finalSalary = totalIncome - salaryAdvances - manualFines - attendanceFines - totalAbsenceDeduction - bhxh - bhyt - bhtn;

    // Trả về JSON để debug
    res.json({
      employeeCode: employee.employeeCode,
      name: employee.name,
      monthYear,
      debug: {
        monthAttendanceCount: monthAttendance.length,
        monthAttendanceRecords: monthAttendance.map(r => ({
          date: r.date,
          status: r.status,
          fine: r.fine,
          halfDayDeduction: r.halfDayDeduction,
        })),
        monthSalesCount: monthSales.length,
      },
      calculation: {
        baseSalary: employee.baseSalary,
        insuranceSalary,
        chuyenCan,
        anTrua,
        hoTroKhac,
        hoaHong,
        totalIncome,
        workDays,
        attendanceFines,
        fullDayAbsenceDeduction,
        halfDayDeduction,
        totalAbsenceDeduction,
        manualFines,
        salaryAdvances,
        bhxh,
        bhyt,
        bhtn,
        finalSalary,
      },
    });
  } catch (error) {
    console.error("Lỗi test tính lương:", error);
    res.status(500).json({ error: "Lỗi test tính lương" });
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
        return parts.length === 3 && parseInt(parts[1]) === parseInt(smm) && parseInt(parts[2]) === parseInt(syyyy);
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
  console.log(`\n[buildPayroll] ===== Tháng: ${monthYear} (mm=${mm}, yyyy=${yyyy}) =====`);
  return employees.map((emp) => {
    const monthAtt = emp.attendanceRecords.filter((r: any) => {
      const parts = r.date ? r.date.split('/') : [];
      return parts.length === 3 && parseInt(parts[1]) === parseInt(mm) && parseInt(parts[2]) === parseInt(yyyy);
    });
    const monthSales = emp.salesRecords.filter((r: any) => {
      if (!r.createdAt) return true;
      const d = new Date(r.createdAt);
      return d.getMonth() + 1 === parseInt(mm) && d.getFullYear() === parseInt(yyyy);
    });
    console.log(`[buildPayroll] ${emp.name}: attendanceRecords tổng=${emp.attendanceRecords.length} lọc tháng=${monthAtt.length} | salesRecords tổng=${emp.salesRecords.length} lọc tháng=${monthSales.length}`);
    if (emp.attendanceRecords.length > 0) {
      console.log(`[buildPayroll]   Sample date: "${emp.attendanceRecords[0]?.date}" → parts[1]="${emp.attendanceRecords[0]?.date?.split('/')[1]}" vs mm="${mm}"`);
    }
    const tamUngRecords = monthSales.filter((r: any) => r.service === "Tạm ứng");
    const phatRecords = monthSales.filter((r: any) => r.service === "Phạt");
    console.log(`[buildPayroll]   tamUng=${tamUngRecords.length} records, phat=${phatRecords.length} records`);

    let hoaHong = 0, tamUng = 0, manualFines = 0;
    monthSales.forEach((r: any) => {
      const amount = Number(r.profit) || 0;
      if (r.service === "Phạt") manualFines += Math.abs(amount);
      else if (r.service === "Tạm ứng") tamUng += Math.abs(amount);
      else if (!["Chuyên cần", "Ăn trưa", "Hỗ trợ khác"].includes(r.service || ""))
        hoaHong += amount;
    });

    // Tính insuranceSalary TRƯỚC khi dùng nó
    const totalSalaryBrutto = emp.baseSalary || 0;
    const ins = totalSalaryBrutto >= threshold ? totalSalaryBrutto - 2_000_000 : totalSalaryBrutto;
    const cc  = totalSalaryBrutto >= threshold ? 1_000_000 : 0;
    const at  = totalSalaryBrutto >= threshold ?   500_000 : 0;
    const htk = totalSalaryBrutto >= threshold ?   500_000 : 0;

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
    
    // Tính trừ lương vắng không phép (1 ngày đầy đủ)
    const fullDayAbsenceDeduction = monthAtt.reduce((s: number, r: any) => {
      if (r.status === "Vắng không phép") {
        return s + Math.round(ins / 21); // 1 ngày lương
      }
      return s;
    }, 0);
    // Tổng trừ lương (cả ngày + nửa ngày)
    const totalAbsenceDeduction = fullDayAbsenceDeduction + halfDayDeduction;
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
// 1c. BREAKDOWN CHI TIẾT LƯƠNG THÁNG (JSON)
// ==========================================
export const getSalaryBreakdown = async (req: Request, res: Response) => {
  try {
    const { monthYear } = req.params as { monthYear: string };

    // 1. KIỂM TRA XEM THÁNG NÀY ĐÃ CHỐT CHƯA
    // Đọc từ bảng SalaryHistory (Bảng lưu kết quả tĩnh)
    const historyRecords = await prisma.salaryHistory.findMany({
      where: { monthYear },
      include: { employee: { select: { name: true, employeeCode: true, role: true } } },
      orderBy: { employee: { name: "asc" } },
    });

    // NẾU ĐÃ CHỐT RỒI -> Lấy số liệu tĩnh từ DB ra trả về (Vì data thô đã xóa)
    if (historyRecords.length > 0) {
      const breakdown = historyRecords.map(h => ({
        name: h.employee?.name ?? "Nhân viên đã xóa",
        employeeCode: h.employee?.employeeCode ?? "",
        role: h.employee?.role ?? "",
        hoaHong: h.hoaHong,
        tamUng: h.tamUng,
        manualFines: h.manualFines,
        attendanceFines: h.attendanceFines,
        halfDayDeduction: h.halfDayDeduction,
        fullDayAbsenceDeduction: h.fullDayAbsenceDeduction,
        totalBonus: h.totalBonus,
        finalSalary: h.finalSalary,
        workDays: h.workDays,
        workDates: h.workDates ?? [],
      }));
      return res.json(breakdown);
    }

    // 2. NẾU CHƯA CHỐT -> Tính toán Live từ DB
    const employees = await prisma.employee.findMany({
      include: { salesRecords: true, attendanceRecords: true },
      orderBy: { name: "asc" },
    });
    
    // Gọi hàm helper tính lương (hàm này ở trên phần code của bạn)
    const breakdown = buildEmployeePayrollData(employees, monthYear);
    res.json(breakdown);
    
  } catch (error) {
    console.error("Lỗi lấy breakdown lương:", error);
    res.status(500).json({ error: "Lỗi lấy breakdown lương" });
  }
};

// ==========================================
// 1d. TẢI BẢNG LƯƠNG TỔNG EXCEL
// ==========================================
export const downloadSalarySummaryExcel = async (req: Request, res: Response) => {
  let tmpJson: string | null = null;
  let tmpXlsx: string | null = null;

  try {
    const { monthYear } = req.params as { monthYear: string };
    
    let scriptPath = path.join(process.cwd(), "src/scripts/gen_salary.py");
    if (!fs.existsSync(scriptPath)) scriptPath = path.join(process.cwd(), "scripts/gen_salary.py");
    if (!fs.existsSync(scriptPath)) return res.status(500).json({ error: "Không tìm thấy file Python generator" });

    // 1. KIỂM TRA LỊCH SỬ CHỐT LƯƠNG
    const historyRecords = await prisma.salaryHistory.findMany({
      where: { monthYear },
      include: { employee: true },
      orderBy: { employee: { name: "asc" } },
    });

    let employeeData = [];

    if (historyRecords.length > 0) {
      // THÁNG ĐÃ CHỐT: Lấy dữ liệu tĩnh từ DB để Python render
      employeeData = historyRecords.map(h => {
        // Tái tạo lại các hằng số bảo hiểm/phụ cấp để điền vào Excel
        const threshold = 8_000_000;
        // Do lúc chốt baseSalary lưu vào DB là lương đã trừ đi 2 triệu (nếu tổng > 8tr)
        // Nên ta dùng lại đúng số đó làm ins
        const ins = h.baseSalary; 
        
        // Suy ngược lại tổng lương ban đầu để gán phụ cấp
        // (Nếu ins < threshold thì lương ban đầu chính là ins, nếu không thì là ins + 2_000_000)
        // Tuy nhiên, cách an toàn nhất là cứ check nếu ins >= 6_000_000 (do đã trừ 2tr)
        // Để đơn giản và khớp mẫu, ta gán cứng dựa vào mốc ins
        const cc  = ins >= (threshold - 2_000_000) ? 1_000_000 : 0;
        const at  = ins >= (threshold - 2_000_000) ?   500_000 : 0;
        const htk = ins >= (threshold - 2_000_000) ?   500_000 : 0;

        const bhxhCty  = Math.round(ins * 0.175);
        const bhytCty  = Math.round(ins * 0.03);
        const bhtnCty  = Math.round(ins * 0.01);
        const totalCty = bhxhCty + bhytCty + bhtnCty;

        const bhxhNld  = Math.round(ins * 0.08);
        const bhytNld  = Math.round(ins * 0.015);
        const bhtnNld  = Math.round(ins * 0.01);
        const totalNld = bhxhNld + bhytNld + bhtnNld;

        // Tổng thu nhập trước thuế/phạt
        const totalSalary = ins + cc + at + htk + (h.hoaHong || 0);

        return {
          employeeCode: h.employee?.employeeCode || "",
          name: h.employee?.name || "Nhân viên đã xóa",
          role: h.employee?.role || "",
          
          // Các cột Excel cần
          baseSalary: ins, // Gán ins vào baseSalary trên Excel
          chuyenCan: cc,
          anTrua: at,
          hoTroKhac: htk,
          hoaHong: h.hoaHong,
          totalBonus: h.totalBonus,
          workDays: h.workDays,
          totalSalary: totalSalary,
          insuranceSalary: ins,
          
          // Bảo hiểm
          bhxhCty, bhytCty, bhtnCty, totalCty,
          bhxhNld, bhytNld, bhtnNld, totalNld,
          
          // Phạt / Trừ
          tamUng: h.tamUng,
          halfDayDeduction: h.halfDayDeduction,
          attendanceFines: h.attendanceFines,
          manualFines: h.manualFines,
          fullDayAbsenceDeduction: h.fullDayAbsenceDeduction,
          
          // Cột Thực Lĩnh
          finalSalary: h.finalSalary,
        };
      });
    } else {
      // THÁNG CHƯA CHỐT: Tính toán Live từ các bảng thô
      const employees = await prisma.employee.findMany({
        include: { salesRecords: true, attendanceRecords: true },
        orderBy: { name: "asc" },
      });
      employeeData = buildEmployeePayrollData(employees, monthYear);
    }

    // 2. CHUẨN BỊ DỮ LIỆU ĐẨY CHO PYTHON
    const summaryData = { monthYear, employees: employeeData };
    const tmpDir = os.tmpdir();
    const ts = Date.now();
    tmpJson = path.join(tmpDir, `salary_excel_${ts}.json`);
    tmpXlsx = path.join(tmpDir, `salary_excel_${ts}.xlsx`);
    
    // Ghi file JSON
    fs.writeFileSync(tmpJson, JSON.stringify(summaryData, null, 2), "utf8");

    // 3. GỌI PYTHON ĐỂ VẼ EXCEL
    const pythonCmd = process.platform === "win32" ? "python" : "python3";
    execSync(`${pythonCmd} "${scriptPath}" excel "${tmpJson}" "${tmpXlsx}"`, { encoding: "utf8", timeout: 30000 });

    // 4. TRẢ FILE VỀ CHO CLIENT
    const filename = `BangLuong_${monthYear.replace("/", "_")}.xlsx`;
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(fs.readFileSync(tmpXlsx));

    // Dọn rác
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
