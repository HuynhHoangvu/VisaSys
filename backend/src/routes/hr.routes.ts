import { Router } from "express";
import { getDepartments, createDepartment, updateDepartment, deleteDepartment } from "../controllers/department.controller.js";
import { getEmployees, createEmployee, updateEmployee, deleteEmployee } from "../controllers/employee.controller.js";
import { checkInEmployee, checkOutEmployee, addManualBonus, deleteSalesRecord, excuseScheduledAbsence, penalizeForgotCheckout, waiveAttendanceFine, waiveHalfDayDeduction } from "../controllers/attendance.controller.js";
import { createLeaveRequest, getLeaveRequests, getLeaveRequestsByEmployee, updateLeaveRequestStatus } from "../controllers/leave.controller.js";
import { finalizeMonthSalary, getSalaryHistory } from "../controllers/salary.controller.js";
import { downloadSalarySlip, downloadSalarySummary, downloadSalarySummaryExcel, downloadSalarySlipsExcel, testSalaryCalculation, getSalaryBreakdown } from "../controllers/salarySlip.controller.js";
import { validate } from "../middlewares/validate.js";
import { requireAuth, requirePermission, requireHrWriteOrSelfAttendance, requireHrReadOrSelfAttendance } from "../middlewares/authorize.js";
import {
  createEmployeeSchema,
  updateEmployeeSchema,
  manualBonusSchema,
  finalizeMonthSchema,
  leaveRequestSchema,
  updateLeaveStatusSchema,
} from "../schemas/index.js";

const router = Router();

const auth = requireAuth;
const hrRead = requirePermission(["hr.registry.read"]);
const hrReadOrSelfAttendance = requirePermission(["hr.registry.read", "hr.attendance.self"], "any");
const hrWrite = requirePermission(["hr.registry.write"]);
const hrDeleteEmp = requirePermission(["hr.employees.delete"]);
const hrPayFinalize = requirePermission(["hr.payroll.finalize"]);
const hrPayExport = requirePermission(["hr.payroll.export"]);
const hrLeaveApprove = requirePermission(["hr.leave.approve"]);
/** Đọc hoặc xuất lương (xem breakdown / test / phiếu) */
const hrPayReadOrExport = requirePermission(["hr.registry.read", "hr.payroll.export"], "any");


// Salary
router.post("/salary/finalize", auth, hrPayFinalize, validate(finalizeMonthSchema), finalizeMonthSalary);
router.get("/salary/history", auth, hrRead, getSalaryHistory);
router.get("/salary/breakdown/:monthYear", auth, hrPayReadOrExport, getSalaryBreakdown);
router.get("/salary/test/:employeeId/:monthYear", auth, hrPayReadOrExport, testSalaryCalculation);
router.get("/salary/slip/:employeeId/:monthYear", auth, hrPayExport, downloadSalarySlip);
router.get("/salary/summary/:monthYear", auth, hrPayExport, downloadSalarySummary);
router.get("/salary/summary-excel/:monthYear", auth, hrPayExport, downloadSalarySummaryExcel);
router.get("/salary/slips-excel/:monthYear", auth, hrPayExport, downloadSalarySlipsExcel);

// Departments
router.get("/departments", auth, hrReadOrSelfAttendance, getDepartments);
router.post("/departments", auth, hrWrite, createDepartment);
router.put("/departments/:id", auth, hrWrite, updateDepartment);
router.delete("/departments/:id", auth, hrWrite, deleteDepartment);

// Employees
router.get("/employees", auth, hrReadOrSelfAttendance, getEmployees);
router.post("/employees", auth, hrWrite, validate(createEmployeeSchema), createEmployee);
router.put("/employees/:id", auth, hrWrite, validate(updateEmployeeSchema), updateEmployee);
router.delete("/employees/:id", auth, hrDeleteEmp, deleteEmployee);

// Attendance (self: hr.attendance.self + :id = session; full: hr.registry.write)
router.post("/employees/:id/checkin", auth, requireHrWriteOrSelfAttendance, checkInEmployee);
router.post("/employees/:id/checkout", auth, requireHrWriteOrSelfAttendance, checkOutEmployee);
router.post("/employees/:id/attendance-records/:recordId/waive-half-day", auth, hrWrite, waiveHalfDayDeduction);
router.post("/employees/:id/attendance-records/:recordId/waive-fine", auth, hrWrite, waiveAttendanceFine);
router.post("/employees/:id/attendance/excuse-absence", auth, hrWrite, excuseScheduledAbsence);
router.post("/employees/:id/bonus", auth, hrWrite, validate(manualBonusSchema), addManualBonus);
router.delete("/employees/:id/sales-records/:salesRecordId", auth, hrWrite, deleteSalesRecord);
router.post("/attendance/penalize-forgot-checkout", auth, hrWrite, penalizeForgotCheckout);

// Leave requests
router.post("/employees/:id/leave", auth, requireHrWriteOrSelfAttendance, validate(leaveRequestSchema), createLeaveRequest);
router.get("/employees/:id/leave", auth, requireHrReadOrSelfAttendance, getLeaveRequestsByEmployee);
router.get("/leave-requests", auth, hrRead, getLeaveRequests);
router.put("/leave-requests/:id/status", auth, hrLeaveApprove, validate(updateLeaveStatusSchema), updateLeaveRequestStatus);

export default router;
