import fs from "fs";
import path from "path";
import os from "os";
import { execSync } from "child_process";
import { prisma } from "../../lib/prisma.js";
import {
  calcBaseComponents,
  calcInsurance,
  calcFullSalary,
  attendanceDateBelongsToPayrollMonth,
  grossSalaryForLockedPayrollAllowances,
} from "./SalaryService.js";
import {
  resolveAbsenceCutoffDay,
  computeAbsentScheduledDates,
  dailyWageFromGrossBase,
  buildLateFineDetailRows,
} from "./attendancePayroll.js";
import { isSaleManager } from "./accessResolution.js";
import { dedupeSalaryHistoryLatestPerEmployeeMonth } from "../utils/salaryHistoryDedupe.js";

function parsePayrollMonthYear(monthYear: string): { mm: number; yyyy: number } {
  const [mmStr, yyyyStr] = monthYear.split("/");
  return { mm: parseInt(mmStr, 10), yyyy: parseInt(yyyyStr, 10) };
}

export function buildEmployeePayrollData(employees: any[], monthYear: string) {
  const { mm, yyyy } = parsePayrollMonthYear(monthYear);
  const cutoff = resolveAbsenceCutoffDay(mm, yyyy);
  const dailyAbsence = (base: number) => dailyWageFromGrossBase(base);

  return employees.map((emp) => {
    const monthAtt = emp.attendanceRecords.filter((r: any) =>
      attendanceDateBelongsToPayrollMonth(r.date, mm, yyyy),
    );
    const monthSales = emp.salesRecords.filter((r: any) => {
      if (!r.createdAt) return true;
      const d = new Date(r.createdAt);
      return d.getMonth() + 1 === mm && d.getFullYear() === yyyy;
    });

    const s = calcFullSalary(emp.baseSalary || 0, monthAtt, monthSales, mm, yyyy, cutoff);
    const ins = s.insuranceSalary;
    const totalBonus = s.chuyenCan + s.anTrua + s.hoTroKhac + s.hoaHong + s.thuongKhac;
    const totalSalary = ins + totalBonus;

    const bhxhCty  = Math.round(ins * 0.175);
    const bhytCty  = Math.round(ins * 0.03);
    const bhtnCty  = Math.round(ins * 0.01);
    const totalCty = bhxhCty + bhytCty + bhtnCty;
    const totalNld = s.bhxhNld + s.bhytNld + s.bhtnNld;

    const lateRecords = monthAtt.filter((r: any) => (r.halfDayDeduction || 0) > 0).map((r: any) => ({
      date: r.date, amount: r.halfDayDeduction, status: r.status,
    }));
    const fineRecords = buildLateFineDetailRows(monthAtt, mm, yyyy);
    const advanceRecords = monthSales.filter((r: any) => r.service === "Tạm ứng").map((r: any) => ({
      date: r.createdAt ? new Date(r.createdAt).toLocaleDateString('vi-VN') : '',
      amount: Math.abs(Number(r.profit) || 0),
      note: r.note || '',
    }));
    const absentDates = computeAbsentScheduledDates(monthAtt, mm, yyyy, cutoff);
    const perDay = dailyAbsence(emp.baseSalary || 0);
    const absenceRecords = absentDates.map((date: string) => ({
      date,
      amount: perDay,
      status: "Không điểm danh",
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
      workDates: s.workDates ?? [],
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

function getScriptPath() {
  let scriptPath = path.join(process.cwd(), "src/scripts/gen_salary.py");
  if (!fs.existsSync(scriptPath)) {
    scriptPath = path.join(process.cwd(), "scripts/gen_salary.py");
  }
  if (!fs.existsSync(scriptPath)) {
    throw new Error("Không tìm thấy file generator (gen_salary.py)");
  }
  return scriptPath;
}

export const downloadSalarySlipService = async (employeeId: string, monthYear: string, user: any) => {
  if (user && user.department === "Sale") {
    if (!isSaleManager(user) && employeeId !== user.id) {
      throw new Error("Bạn chỉ có quyền xem bảng lương của chính mình");
    }
    const targetEmployee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: { department: true },
    });
    if (!targetEmployee || targetEmployee.department?.name !== "Sale") {
      throw new Error("Bạn chỉ có quyền xem bảng lương của nhân viên phòng Sale");
    }
  }

  const scriptPath = getScriptPath();

  const historyRecord = await prisma.salaryHistory.findUnique({
    where: { employeeId_monthYear: { employeeId, monthYear } },
    include: { employee: true },
  });

  let data: any = {};

  if (historyRecord) {
    const ins = historyRecord.baseSalary;
    const gross = grossSalaryForLockedPayrollAllowances(historyRecord);
    const { chuyenCan, anTrua, hoTroKhac } = calcBaseComponents(gross);
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
      workDays: Math.max(
        historyRecord.workDays || 0,
        (historyRecord.workDates && historyRecord.workDates.length) || 0,
      ),
      workDates: historyRecord.workDates || [],
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
    const { mm, yyyy } = parsePayrollMonthYear(monthYear);
    const monthStart = new Date(yyyy, mm - 1, 1);
    const monthEnd   = new Date(yyyy, mm, 1);

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        attendanceRecords: {
          where: {
            OR: [
              { date: { contains: `/${String(mm).padStart(2, "0")}/${yyyy}` } },
              { date: { contains: `/${mm}/${yyyy}` } },
            ],
          },
        },
        salesRecords: {
          where: { createdAt: { gte: monthStart, lt: monthEnd } }
        }
      }
    });
    if (!employee) throw new Error("Không tìm thấy nhân viên");

    const monthAttendance = employee.attendanceRecords.filter((r) =>
      attendanceDateBelongsToPayrollMonth(r.date, mm, yyyy),
    );

    const salary = calcFullSalary(
      employee.baseSalary || 0,
      monthAttendance as any,
      employee.salesRecords as any,
      mm,
      yyyy,
      resolveAbsenceCutoffDay(mm, yyyy),
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
      workDates: salary.workDates,
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
  const tmpJson = path.join(tmpDir, `salary_${employeeId}_${Date.now()}.json`);
  const tmpPdf = path.join(tmpDir, `salary_${employeeId}_${Date.now()}.pdf`);
  fs.writeFileSync(tmpJson, JSON.stringify(data));

  const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
  try {
    execSync(`${pythonCmd} "${scriptPath}" "${tmpJson}" "${tmpPdf}"`, {
      encoding: "utf8",
      timeout: 30000,
    });
  } finally {
    if (fs.existsSync(tmpJson)) fs.unlinkSync(tmpJson);
  }

  const buffer = fs.readFileSync(tmpPdf);
  fs.unlinkSync(tmpPdf);

  const safeName = data.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").replace(/[^\w\-\.]/g, '_').toLowerCase();
  const safeMonth = monthYear.replace("/", "_");
  const filename = `PhieuLuong_${safeName}_${safeMonth}.pdf`;

  return { buffer, filename };
};

export const testSalaryCalculationService = async (employeeId: string, monthYear: string, user: any) => {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    include: { salesRecords: true, attendanceRecords: true, department: true },
  });
  if (!employee) throw new Error("Không tìm thấy nhân viên");

  if (user && user.department === "Sale") {
    if (!isSaleManager(user) && employeeId !== user.id) {
      throw new Error("Bạn chỉ có quyền xem bảng lương của chính mình");
    }
    if (employee.department?.name !== "Sale") {
      throw new Error("Bạn chỉ có quyền xem bảng lương của nhân viên phòng Sale");
    }
  }

  const { mm: pm, yyyy: py } = parsePayrollMonthYear(monthYear);
  const monthAttendance = employee.attendanceRecords.filter((r) =>
    attendanceDateBelongsToPayrollMonth(r.date, pm, py),
  );
  const monthSales = employee.salesRecords.filter((r) => {
    if (!r.createdAt) return true;
    const d = new Date(r.createdAt);
    return d.getMonth() + 1 === pm && d.getFullYear() === py;
  });

  const cutoff = resolveAbsenceCutoffDay(pm, py);
  const salary = calcFullSalary(
    employee.baseSalary || 0,
    monthAttendance as any,
    monthSales as any,
    pm,
    py,
    cutoff,
  );

  return {
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
  };
};

export const downloadSalarySummaryService = async (monthYear: string, user: any) => {
  const scriptPath = getScriptPath();
  let whereClause: Record<string, any> = {};
  
  if (user && user.department === "Sale") {
    if (isSaleManager(user)) {
      whereClause = { department: { name: "Sale" } };
    } else {
      whereClause = { id: user.id };
    }
  }

  const employees = await prisma.employee.findMany({
    where: whereClause,
    include: { salesRecords: true, attendanceRecords: true },
    orderBy: { name: "asc" },
  });

  const employeeData = buildEmployeePayrollData(employees, monthYear);
  const summaryData = { monthYear, employees: employeeData };

  const tmpDir = os.tmpdir();
  const ts = Date.now();
  const tmpJson = path.join(tmpDir, `salary_summary_${ts}.json`);
  const tmpPdf  = path.join(tmpDir, `salary_summary_${ts}.pdf`);
  fs.writeFileSync(tmpJson, JSON.stringify(summaryData, null, 2), "utf8");

  const pythonCmd = process.platform === "win32" ? "python" : "python3";
  try {
    execSync(`${pythonCmd} "${scriptPath}" summary "${tmpJson}" "${tmpPdf}"`, {
      encoding: "utf8",
      timeout: 30000,
    });
  } catch (pyError: any) {
    if (fs.existsSync(tmpJson)) fs.unlinkSync(tmpJson);
    throw new Error("Python failed: " + (pyError.stderr || pyError.message));
  }
  
  if (fs.existsSync(tmpJson)) fs.unlinkSync(tmpJson);

  const buffer = fs.readFileSync(tmpPdf);
  fs.unlinkSync(tmpPdf);

  const safeMonth = monthYear.replace("/", "_");
  const filename = `BangLuong_${safeMonth}.pdf`;
  return { buffer, filename };
};

export const getSalaryBreakdownService = async (monthYear: string, user: any) => {
  const historyRows = await prisma.salaryHistory.findMany({
    where: { monthYear },
    include: { employee: { select: { name: true, employeeCode: true, role: true, department: true } } },
    orderBy: { employee: { name: "asc" } },
  });
  const historyRecords = dedupeSalaryHistoryLatestPerEmployeeMonth(historyRows).sort((a, b) =>
    (a.employee?.name || "").localeCompare(b.employee?.name || "", "vi"),
  );

  if (historyRecords.length > 0) {
    let filteredRecords = historyRecords;
    if (user && user.department === "Sale") {
      if (isSaleManager(user)) {
        filteredRecords = historyRecords.filter(h => h.employee?.department?.name === "Sale");
      } else {
        filteredRecords = historyRecords.filter(h => h.employeeId === user.id);
      }
    }
    return filteredRecords.map(h => ({
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
      workDates: h.workDates ?? [],
    }));
  }

  let whereClause: Record<string, any> = {};
  if (user && user.department === "Sale") {
    if (isSaleManager(user)) {
      whereClause = { department: { name: "Sale" } };
    } else {
      whereClause = { id: user.id };
    }
  }
  const employees = await prisma.employee.findMany({
    where: whereClause,
    include: { salesRecords: true, attendanceRecords: true },
    orderBy: { name: "asc" },
  });
  
  return buildEmployeePayrollData(employees, monthYear);
};

export const downloadSalarySummaryExcelService = async (monthYear: string, user: any) => {
  const scriptPath = getScriptPath();

  const historyRows = await prisma.salaryHistory.findMany({
    where: { monthYear },
    include: { employee: { include: { department: true } } },
    orderBy: { employee: { name: "asc" } },
  });
  const historyRecords = dedupeSalaryHistoryLatestPerEmployeeMonth(historyRows).sort((a, b) =>
    (a.employee?.name || "").localeCompare(b.employee?.name || "", "vi"),
  );

  let employeeData: any[] = [];
  let filteredRecords = historyRecords;
  if (user && user.department === "Sale") {
    if (isSaleManager(user)) {
      filteredRecords = historyRecords.filter(h => h.employee?.department?.name === "Sale");
    } else {
      filteredRecords = historyRecords.filter(h => h.employeeId === user.id);
    }
  }

  if (filteredRecords.length > 0) {
    employeeData = filteredRecords.map(h => {
      const ins = h.baseSalary;
      const gross = grossSalaryForLockedPayrollAllowances(h);
      const { chuyenCan: cc, anTrua: at, hoTroKhac: htk } = calcBaseComponents(gross);
      const { bhxhNld, bhytNld, bhtnNld } = calcInsurance(ins);
      const bhxhCty  = Math.round(ins * 0.175);
      const bhytCty  = Math.round(ins * 0.03);
      const bhtnCty  = Math.round(ins * 0.01);
      const totalCty = bhxhCty + bhytCty + bhtnCty;
      const totalNld = bhxhNld + bhytNld + bhtnNld;
      const totalSalary = ins + cc + at + htk + (h.hoaHong || 0) + (h.thuongKhac || 0);

      return {
        employeeCode: h.employee?.employeeCode || "",
        name: h.employee?.name || "Nhân viên đã xóa",
        role: h.employee?.role || "",
        baseSalary: ins,
        chuyenCan: cc,
        anTrua: at,
        hoTroKhac: htk,
        hoaHong: h.hoaHong,
        thuongKhac: h.thuongKhac ?? 0,
        totalBonus: h.totalBonus,
        workDays: h.workDays,
        workDates: h.workDates ?? [],
        totalSalary: totalSalary,
        insuranceSalary: ins,
        bhxhCty, bhytCty, bhtnCty, totalCty,
        bhxhNld, bhytNld, bhtnNld, totalNld,
        tamUng: h.tamUng,
        halfDayDeduction: h.halfDayDeduction,
        attendanceFines: h.attendanceFines,
        manualFines: h.manualFines,
        fullDayAbsenceDeduction: h.fullDayAbsenceDeduction,
        finalSalary: h.finalSalary,
      };
    });
  } else {
    let whereClause: Record<string, any> = {};
    if (user && user.department === "Sale") {
      if (isSaleManager(user)) {
        whereClause = { department: { name: "Sale" } };
      } else {
        whereClause = { id: user.id };
      }
    }
    const employees = await prisma.employee.findMany({
      where: whereClause,
      include: { salesRecords: true, attendanceRecords: true },
      orderBy: { name: "asc" },
    });
    employeeData = buildEmployeePayrollData(employees, monthYear);
  }

  const summaryData = { monthYear, employees: employeeData };
  const tmpDir = os.tmpdir();
  const ts = Date.now();
  const tmpJson = path.join(tmpDir, `salary_excel_${ts}.json`);
  const tmpXlsx = path.join(tmpDir, `salary_excel_${ts}.xlsx`);
  
  fs.writeFileSync(tmpJson, JSON.stringify(summaryData, null, 2), "utf8");

  const pythonCmd = process.platform === "win32" ? "python" : "python3";
  try {
    execSync(`${pythonCmd} "${scriptPath}" excel "${tmpJson}" "${tmpXlsx}"`, { encoding: "utf8", timeout: 30000 });
  } finally {
    if (fs.existsSync(tmpJson)) fs.unlinkSync(tmpJson);
  }

  const buffer = fs.readFileSync(tmpXlsx);
  fs.unlinkSync(tmpXlsx);

  const filename = `BangLuong_${monthYear.replace("/", "_")}.xlsx`;
  return { buffer, filename };
};

export const downloadSalarySlipsExcelService = async (monthYear: string, user: any) => {
  const scriptPath = getScriptPath();
  let whereClause: Record<string, any> = {};
  if (user && user.department === "Sale") {
    if (isSaleManager(user)) {
      whereClause = { department: { name: "Sale" } };
    } else {
      whereClause = { id: user.id };
    }
  }
  const employees = await prisma.employee.findMany({
    where: whereClause,
    include: { salesRecords: true, attendanceRecords: true },
    orderBy: { name: "asc" },
  });

  const summaryData = { monthYear, employees: buildEmployeePayrollData(employees, monthYear) };
  const tmpDir = os.tmpdir();
  const ts = Date.now();
  const tmpJson = path.join(tmpDir, `salary_slips_${ts}.json`);
  const tmpXlsx = path.join(tmpDir, `salary_slips_${ts}.xlsx`);
  fs.writeFileSync(tmpJson, JSON.stringify(summaryData, null, 2), "utf8");

  const pythonCmd = process.platform === "win32" ? "python" : "python3";
  try {
    execSync(`${pythonCmd} "${scriptPath}" slips "${tmpJson}" "${tmpXlsx}"`, { encoding: "utf8", timeout: 30000 });
  } finally {
    if (fs.existsSync(tmpJson)) fs.unlinkSync(tmpJson);
  }

  const buffer = fs.readFileSync(tmpXlsx);
  fs.unlinkSync(tmpXlsx);

  const filename = `PhieuLuong_${monthYear.replace("/", "_")}.xlsx`;
  return { buffer, filename };
};
