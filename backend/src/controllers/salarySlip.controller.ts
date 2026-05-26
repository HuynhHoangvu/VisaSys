import { Request, Response } from "express";
import {
  downloadSalarySlipService,
  testSalaryCalculationService,
  downloadSalarySummaryService,
  getSalaryBreakdownService,
  downloadSalarySummaryExcelService,
  downloadSalarySlipsExcelService,
} from "../services/salarySlip.service.js";

export const downloadSalarySlip = async (req: Request, res: Response) => {
  try {
    const { employeeId, monthYear } = req.params as { employeeId: string; monthYear: string };
    const user = (req.session as any).user;

    const { buffer, filename } = await downloadSalarySlipService(employeeId, monthYear, user);

    const encodedFilename = encodeURIComponent(filename);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${encodedFilename}"; filename*=UTF-8''${encodedFilename}`);
    res.send(buffer);
  } catch (error: any) {
    if (error.message.includes("quyền xem bảng lương")) {
      return res.status(403).json({ error: error.message });
    }
    if (error.message === "Không tìm thấy nhân viên") {
      return res.status(404).json({ error: error.message });
    }
    console.error("Lỗi tạo phiếu lương:", error);
    res.status(500).json({ error: "Lỗi tạo phiếu lương PDF" });
  }
};

export const testSalaryCalculation = async (req: Request, res: Response) => {
  try {
    const { employeeId, monthYear } = req.params as { employeeId: string; monthYear: string };
    const user = (req.session as any).user;

    const data = await testSalaryCalculationService(employeeId, monthYear, user);
    res.json(data);
  } catch (error: any) {
    if (error.message === "Không tìm thấy nhân viên") {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.includes("quyền xem bảng lương")) {
      return res.status(403).json({ error: error.message });
    }
    console.error("Lỗi test tính lương:", error);
    res.status(500).json({ error: "Lỗi test tính lương" });
  }
};

export const downloadSalarySummary = async (req: Request, res: Response) => {
  try {
    const { monthYear } = req.params as { monthYear: string };
    const user = (req.session as any).user;

    const { buffer, filename } = await downloadSalarySummaryService(monthYear, user);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error: any) {
    console.error("Lỗi tạo bảng lương tổng:", error);
    res.status(500).json({ error: "Lỗi tạo bảng lương tổng PDF" });
  }
};

export const getSalaryBreakdown = async (req: Request, res: Response) => {
  try {
    const { monthYear } = req.params as { monthYear: string };
    const user = (req.session as any).user;

    const breakdown = await getSalaryBreakdownService(monthYear, user);
    res.json(breakdown);
  } catch (error) {
    console.error("Lỗi lấy breakdown lương:", error);
    res.status(500).json({ error: "Lỗi lấy breakdown lương" });
  }
};

export const downloadSalarySummaryExcel = async (req: Request, res: Response) => {
  try {
    const { monthYear } = req.params as { monthYear: string };
    const user = (req.session as any).user;

    const { buffer, filename } = await downloadSalarySummaryExcelService(monthYear, user);

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error) {
    console.error("Lỗi tạo bảng lương tổng Excel:", error);
    res.status(500).json({ error: "Lỗi tạo bảng lương tổng Excel" });
  }
};

export const downloadSalarySlipsExcel = async (req: Request, res: Response) => {
  try {
    const { monthYear } = req.params as { monthYear: string };
    const user = (req.session as any).user;

    const { buffer, filename } = await downloadSalarySlipsExcelService(monthYear, user);

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error) {
    console.error("Lỗi tạo phiếu lương Excel:", error);
    res.status(500).json({ error: "Lỗi tạo phiếu lương Excel" });
  }
};
