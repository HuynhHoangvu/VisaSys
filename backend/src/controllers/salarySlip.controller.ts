import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
import { Request, Response } from "express";
import { prisma } from "../../lib/prisma.js";
import { calcBaseComponents, calcInsurance, calcFullSalary } from "../services/SalaryService.js";
import { SALARY_THRESHOLD } from "../constants/index.js";
import { dedupeSalaryHistoryLatestPerEmployeeMonth } from "../utils/salaryHistoryDedupe.js";

/**
 * Download a single employee salary slip as a PDF.
 * This endpoint prefers finalized payroll history if available, and falls back to live salary calculation otherwise.
 */
// ==========================================
// 1. DOWNLOAD SALARY SLIP PDF
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

    // 1. Prefer finalized payroll history when available
    const historyRecord = await prisma.salaryHistory.findUnique({
      where: { employeeId_monthYear: { employeeId, monthYear } },
      include: { employee: true },
    });

    let data: any = {};

    if (historyRecord) {
      // If the month is finalized: reuse snapshot data and recompute allowances via SalaryService
      const ins = historyRecord.baseSalary;
      const { chuyenCan, anTrua, hoTroKhac } = calcBaseComponents(ins >= SALARY_THRESHOLD ? ins + 2_000_000 : ins);
      const { bhxhNld, bhytNld, bhtnNld } = calcInsurance(ins);

      data = {
        employeeCode: historyRecord.employee?.employeeCode || "",
        name: historyRecord.employee?.name || "Nhân viên",
        role: historyRecord.employee?.role || "",
        monthYear,
        baseSalary: ins,
        chuyenCan,
        anTrua,
        hoTroKhac,
        hoaHong: historyRecord.hoaHong || 0,
        thuongKhac: historyRecord.thuongKhac || 0,
        insuranceSalary: ins,
        workDays: historyRecord.workDays || 0,
        workDates: [],
        tamUng: historyRecord.tamUng || 0,
        fullDayAbsenceDeduction: historyRecord.fullDayAbsenceDeduction || 0,
        halfDayDeduction: historyRecord.halfDayDeduction || 0,
        attendanceFines: historyRecord.attendanceFines || 0,
        manualFines: historyRecord.manualFines || 0,
        bhxhNld,
        bhytNld,
        bhtnNld,
        finalSalary: historyRecord.finalSalary || 0,
      };
    } else {
      // If not finalized: compute live salary figures from current records
      const [mm, yyyy] = monthYear.split('/');
      const monthStart = new Date(parseInt(yyyy), parseInt(mm) - 1, 1);
      const monthEnd   = new Date(parseInt(yyyy), parseInt(mm), 1);

      const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
        include: {
          attendanceRecords: {
            where: {
              OR: [
                { date: { contains: `/${String(parseInt(mm, 10)).padStart(2, "0")}/${yyyy}` } },
                { date: { contains: `/${parseInt(mm, 10)}/${yyyy}` } },
              ],
            },
          },
          salesRecords: {
            where: { createdAt: { gte: monthStart, lt: monthEnd } }
          }
        }
      });
      if (!employee) return res.status(404).json({ error: "Không tìm thấy nhân viên" });

      const salary = calcFullSalary(
        employee.baseSalary || 0,
        employee.attendanceRecords,
        employee.salesRecords
      );

      data = {
        employeeCode: employee.employeeCode,
        name: employee.name,
        role: employee.role,
        monthYear,
        baseSalary: salary.insuranceSalary,
        chuyenCan: salary.chuyenCan,
        anTrua: salary.anTrua,
        hoTroKhac: salary.hoTroKhac,
        hoaHong: salary.hoaHong,
        thuongKhac: salary.thuongKhac,
        insuranceSalary: salary.insuranceSalary,
        workDays: salary.workDays,
        workDates: [],
        tamUng: salary.tamUng,
        fullDayAbsenceDeduction: salary.fullDayAbsenceDeduction,
        halfDayDeduction: salary.halfDayDeduction,
        attendanceFines: salary.attendanceFines,
        manualFines: salary.manualFines,
        bhxhNld: salary.bhxhNld,
        bhytNld: salary.bhytNld,
        bhtnNld: salary.bhtnNld,
        finalSalary: salary.finalSalary,
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

/**
 * Return debug payload for salary calculation.
 * This endpoint is intended for development and validation of payroll computation logic.
 */
// ==========================================
// 1a-DEBUG: Test salary calculation data (JSON only)
// ==========================================
export const testSalaryCalculation = async (req: Request, res: Response) => {
  try {
    const { employeeId, monthYear } = req.params as { employeeId: string; monthYear: string };

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: { salesRecords: true, attendanceRecords: true },
    });
    if (!employee) return res.status(404).json({ error: "Không tìm thấy nhân viên" });

    // Filter attendance and sales records by the requested payroll month
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

    const salary = calcFullSalary(employee.baseSalary || 0, monthAttendance, monthSales);

    // Return JSON payload for debugging
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
        insuranceSalary: salary.insuranceSalary,
        chuyenCan: salary.chuyenCan,
        anTrua: salary.anTrua,
        hoTroKhac: salary.hoTroKhac,
        hoaHong: salary.hoaHong,
        totalIncome: salary.insuranceSalary + salary.chuyenCan + salary.anTrua + salary.hoTroKhac + salary.hoaHong + salary.thuongKhac,
        workDays: salary.workDays,
        attendanceFines: salary.attendanceFines,
        fullDayAbsenceDeduction: salary.fullDayAbsenceDeduction,
        halfDayDeduction: salary.halfDayDeduction,
        totalAbsenceDeduction: salary.fullDayAbsenceDeduction + salary.halfDayDeduction,
        manualFines: salary.manualFines,
        salaryAdvances: salary.tamUng,
        bhxhNld: salary.bhxhNld,
        bhytNld: salary.bhytNld,
        bhtnNld: salary.bhtnNld,
        finalSalary: salary.finalSalary,
      },
    });
  } catch (error) {
    console.error("Lỗi test tính lương:", error);
    res.status(500).json({ error: "Lỗi test tính lương" });
  }
};

/**
 * Generate a PDF summary of the entire payroll for a payroll month.
 * Uses live salary calculations for each employee and renders the result via Python.
 */
// ==========================================
// 1b. DOWNLOAD TOTAL PAYROLL PDF
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

    const employeeData = employees.map((emp) => {
      const s = calcFullSalary(emp.baseSalary || 0, emp.attendanceRecords, emp.salesRecords);
      const ins = s.insuranceSalary;
      const totalBonus = s.chuyenCan + s.anTrua + s.hoTroKhac + s.hoaHong + s.thuongKhac;
      const totalSalary = ins + totalBonus;
      const bhxhCty  = Math.round(ins * 0.175);
      const bhytCty  = Math.round(ins * 0.03);
      const bhtnCty  = Math.round(ins * 0.01);
      const totalCty = bhxhCty + bhytCty + bhtnCty;
      const totalNld = s.bhxhNld + s.bhytNld + s.bhtnNld;

      return {
        name: emp.name,
        role: emp.role || "",
        baseSalary: ins,
        chuyenCan: s.chuyenCan,
        anTrua: s.anTrua,
        hoTroKhac: s.hoTroKhac,
        hoaHong: s.hoaHong,
        thuongKhac: s.thuongKhac,
        totalBonus,
        workDays: s.workDays,
        totalSalary,
        insuranceSalary: ins,
        bhxhCty, bhytCty, bhtnCty, totalCty,
        bhxhNld: s.bhxhNld, bhytNld: s.bhytNld, bhtnNld: s.bhtnNld, totalNld,
        tamUng: s.tamUng,
        halfDayDeduction: s.halfDayDeduction,
        finalSalary: s.finalSalary,
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

/**
 * Build the monthly payroll payload for every employee.
 * This helper consolidates raw attendance and sales records into the Excel/generation model.
 */
// ==========================================
// 1c. DOWNLOAD TOTAL PAYROLL EXCEL (NEW)
// ==========================================
// Helper: build monthly payroll data for each employee
function buildEmployeePayrollData(employees: any[], monthYear: string) {
  const [mm, yyyy] = monthYear.split('/');
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

    const s = calcFullSalary(emp.baseSalary || 0, monthAtt, monthSales);
    const ins = s.insuranceSalary;
    const totalBonus = s.chuyenCan + s.anTrua + s.hoTroKhac + s.hoaHong + s.thuongKhac;
    const totalSalary = ins + totalBonus;


    const bhxhCty  = Math.round(ins * 0.175);
    const bhytCty  = Math.round(ins * 0.03);
    const bhtnCty  = Math.round(ins * 0.01);
    const totalCty = bhxhCty + bhytCty + bhtnCty;
    const totalNld = s.bhxhNld + s.bhytNld + s.bhtnNld;

    // Build detail records for late arrivals, fines, advances, and absences
    const lateRecords = monthAtt.filter((r: any) => (r.halfDayDeduction || 0) > 0).map((r: any) => ({
      date: r.date, amount: r.halfDayDeduction, status: r.status,
    }));
    const fineRecords = monthAtt.filter((r: any) => (r.fine || 0) > 0).map((r: any) => ({
      date: r.date, amount: r.fine, status: r.status,
    }));
    const advanceRecords = monthSales.filter((r: any) => r.service === "Tạm ứng").map((r: any) => ({
      date: r.createdAt ? new Date(r.createdAt).toLocaleDateString('vi-VN') : '',
      amount: Math.abs(Number(r.profit) || 0),
      note: r.note || '',
    }));
    const absenceRecords = monthAtt.filter((r: any) => r.status === "Vắng không phép").map((r: any) => ({
      date: r.date, amount: Math.round(ins / 21), status: r.status,
    }));

    return {
      employeeCode: emp.employeeCode || "",
      name: emp.name,
      role: emp.role || "",
      baseSalary: ins,
      chuyenCan: s.chuyenCan,
      anTrua: s.anTrua,
      hoTroKhac: s.hoTroKhac,
      hoaHong: s.hoaHong,
      thuongKhac: s.thuongKhac,
      totalBonus,
      workDays: s.workDays,
      workDates: [],
      totalSalary,
      insuranceSalary: ins,
      bhxhCty, bhytCty, bhtnCty, totalCty,
      bhxhNld: s.bhxhNld, bhytNld: s.bhytNld, bhtnNld: s.bhtnNld, totalNld,
      tamUng: s.tamUng,
      fullDayAbsenceDeduction: s.fullDayAbsenceDeduction,
      halfDayDeduction: s.halfDayDeduction,
      attendanceFines: s.attendanceFines,
      manualFines: s.manualFines,
      finalSalary: s.finalSalary,
      lateRecords,
      fineRecords,
      advanceRecords,
      absenceRecords,
    };
  });
}

/**
 * Return a detailed JSON salary breakdown for the requested payroll month.
 * If the month is finalized, the stored snapshot is used; otherwise the breakdown is computed live.
 */
// ==========================================
// 1c. SALARY BREAKDOWN DETAIL (JSON)
// ==========================================
export const getSalaryBreakdown = async (req: Request, res: Response) => {
  try {
    const { monthYear } = req.params as { monthYear: string };

    // 1. Check whether this payroll month has been finalized
    // Read finalized snapshot rows from SalaryHistory
    const historyRows = await prisma.salaryHistory.findMany({
      where: { monthYear },
      include: { employee: { select: { name: true, employeeCode: true, role: true } } },
      orderBy: { employee: { name: "asc" } },
    });
    const historyRecords = dedupeSalaryHistoryLatestPerEmployeeMonth(historyRows).sort((a, b) =>
      (a.employee?.name || "").localeCompare(b.employee?.name || "", "vi"),
    );

    // If finalized, return the stored snapshot because raw source data may have been purged
    if (historyRecords.length > 0) {
      const breakdown = historyRecords.map(h => ({
        name: h.employee?.name ?? "Nhân viên đã xóa",
        employeeCode: h.employee?.employeeCode ?? "",
        role: h.employee?.role ?? "",
        hoaHong: h.hoaHong,
        thuongKhac: h.thuongKhac ?? 0,
        tamUng: h.tamUng,
        manualFines: h.manualFines,
        attendanceFines: h.attendanceFines,
        halfDayDeduction: h.halfDayDeduction,
        fullDayAbsenceDeduction: h.fullDayAbsenceDeduction,
        totalBonus: h.totalBonus,
        finalSalary: h.finalSalary,
        workDays: h.workDays,
      }));
      return res.json(breakdown);
    }

    // 2. If not finalized, compute the breakdown live from raw records
    const employees = await prisma.employee.findMany({
      include: { salesRecords: true, attendanceRecords: true },
      orderBy: { name: "asc" },
    });
    
    // Use the shared payroll helper defined above
    const breakdown = buildEmployeePayrollData(employees, monthYear);
    res.json(breakdown);
    
  } catch (error) {
    console.error("Lỗi lấy breakdown lương:", error);
    res.status(500).json({ error: "Lỗi lấy breakdown lương" });
  }
};

/**
 * Generate a total payroll Excel workbook for the requested month.
 * The workbook uses either finalized payroll history or live payroll data as needed.
 */
// ==========================================
// 1d. DOWNLOAD TOTAL PAYROLL EXCEL
// ==========================================
export const downloadSalarySummaryExcel = async (req: Request, res: Response) => {
  let tmpJson: string | null = null;
  let tmpXlsx: string | null = null;

  try {
    const { monthYear } = req.params as { monthYear: string };
    
    let scriptPath = path.join(process.cwd(), "src/scripts/gen_salary.py");
    if (!fs.existsSync(scriptPath)) scriptPath = path.join(process.cwd(), "scripts/gen_salary.py");
    if (!fs.existsSync(scriptPath)) return res.status(500).json({ error: "Không tìm thấy file Python generator" });

    // 1. Check finalized payroll history
    const historyRows = await prisma.salaryHistory.findMany({
      where: { monthYear },
      include: { employee: true },
      orderBy: { employee: { name: "asc" } },
    });
    const historyRecords = dedupeSalaryHistoryLatestPerEmployeeMonth(historyRows).sort((a, b) =>
      (a.employee?.name || "").localeCompare(b.employee?.name || "", "vi"),
    );

    let employeeData: any[] = [];

    if (historyRecords.length > 0) {
      // Finalized month: use static snapshot data for Python rendering
      employeeData = historyRecords.map(h => {
        // In DB, baseSalary corresponds to insuranceSalary (after the threshold adjustment)
        const ins = h.baseSalary;
        const { chuyenCan: cc, anTrua: at, hoTroKhac: htk } = calcBaseComponents(ins >= (SALARY_THRESHOLD - 2_000_000) ? ins + 2_000_000 : ins);
        const { bhxhNld, bhytNld, bhtnNld } = calcInsurance(ins);
        const bhxhCty  = Math.round(ins * 0.175);
        const bhytCty  = Math.round(ins * 0.03);
        const bhtnCty  = Math.round(ins * 0.01);
        const totalCty = bhxhCty + bhytCty + bhtnCty;
        const totalNld = bhxhNld + bhytNld + bhtnNld;

        // Total pre-tax/pre-deduction income
        const totalSalary = ins + cc + at + htk + (h.hoaHong || 0) + (h.thuongKhac || 0);

        return {
          employeeCode: h.employee?.employeeCode || "",
          name: h.employee?.name || "Nhân viên đã xóa",
          role: h.employee?.role || "",
          
          // Columns required for Excel export
          baseSalary: ins, // Map computed insurance salary into Excel's baseSalary field
          chuyenCan: cc,
          anTrua: at,
          hoTroKhac: htk,
          hoaHong: h.hoaHong,
          thuongKhac: h.thuongKhac ?? 0,
          totalBonus: h.totalBonus,
          workDays: h.workDays,
          workDates: [],
          totalSalary: totalSalary,
          insuranceSalary: ins,
          
          // Employer insurance contributions
          bhxhCty, bhytCty, bhtnCty, totalCty,
          bhxhNld, bhytNld, bhtnNld, totalNld,
          
          // Deductions / penalties
          tamUng: h.tamUng,
          halfDayDeduction: h.halfDayDeduction,
          attendanceFines: h.attendanceFines,
          manualFines: h.manualFines,
          fullDayAbsenceDeduction: h.fullDayAbsenceDeduction,
          
          // Net pay column
          finalSalary: h.finalSalary,
        };
      });
    } else {
      // Not finalized: calculate live from raw tables
      const employees = await prisma.employee.findMany({
        include: { salesRecords: true, attendanceRecords: true },
        orderBy: { name: "asc" },
      });
      employeeData = buildEmployeePayrollData(employees, monthYear);
    }

    // 2. Prepare payload for Python renderer
    const summaryData = { monthYear, employees: employeeData };
    const tmpDir = os.tmpdir();
    const ts = Date.now();
    tmpJson = path.join(tmpDir, `salary_excel_${ts}.json`);
    tmpXlsx = path.join(tmpDir, `salary_excel_${ts}.xlsx`);
    
    // Write JSON payload file
    fs.writeFileSync(tmpJson, JSON.stringify(summaryData, null, 2), "utf8");

    // 3. Invoke Python to render Excel
    const pythonCmd = process.platform === "win32" ? "python" : "python3";
    execSync(`${pythonCmd} "${scriptPath}" excel "${tmpJson}" "${tmpXlsx}"`, { encoding: "utf8", timeout: 30000 });

    // 4. Return the generated file to the client
    const filename = `BangLuong_${monthYear.replace("/", "_")}.xlsx`;
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(fs.readFileSync(tmpXlsx));

    // Cleanup temporary files
    if (tmpJson && fs.existsSync(tmpJson)) fs.unlinkSync(tmpJson);
    if (tmpXlsx && fs.existsSync(tmpXlsx)) fs.unlinkSync(tmpXlsx);

  } catch (error) {
    if (tmpJson && fs.existsSync(tmpJson)) fs.unlinkSync(tmpJson);
    if (tmpXlsx && fs.existsSync(tmpXlsx)) fs.unlinkSync(tmpXlsx);
    console.error("Lỗi tạo bảng lương tổng Excel:", error);
    res.status(500).json({ error: "Lỗi tạo bảng lương tổng Excel" });
  }
};

/**
 * Generate individual employee salary slip Excel workbook sheets for the requested payroll month.
 * Each employee receives a dedicated sheet in the workbook.
 */
// ==========================================
// 1d. DOWNLOAD INDIVIDUAL SALARY SLIPS EXCEL (one sheet per employee)
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
