import { Router } from "express";
import { getDepartments, createDepartment, updateDepartment, deleteDepartment } from "../controllers/department.controller.js";
import { getEmployees, createEmployee, updateEmployee, deleteEmployee } from "../controllers/employee.controller.js";
import { checkInEmployee, checkOutEmployee, addManualBonus, deleteSalesRecord, penalizeForgotCheckout, waiveAttendanceFine, waiveHalfDayDeduction } from "../controllers/attendance.controller.js";
import { createLeaveRequest, getLeaveRequests, getLeaveRequestsByEmployee, updateLeaveRequestStatus } from "../controllers/leave.controller.js";
import { finalizeMonthSalary, getSalaryHistory } from "../controllers/salary.controller.js";
import { downloadSalarySlip, downloadSalarySummary, downloadSalarySummaryExcel, downloadSalarySlipsExcel, testSalaryCalculation, getSalaryBreakdown } from "../controllers/salarySlip.controller.js";
import { validate } from "../middlewares/validate.js";
import {
  createEmployeeSchema,
  updateEmployeeSchema,
  manualBonusSchema,
  finalizeMonthSchema,
  leaveRequestSchema,
  updateLeaveStatusSchema,
} from "../schemas/index.js";

const router = Router();

// Salary
router.post("/salary/finalize",                  validate(finalizeMonthSchema), finalizeMonthSalary);
router.get("/salary/history",                    getSalaryHistory);
router.get("/salary/breakdown/:monthYear",       getSalaryBreakdown);
router.get("/salary/test/:employeeId/:monthYear",testSalaryCalculation);
router.get("/salary/slip/:employeeId/:monthYear",downloadSalarySlip);
router.get("/salary/summary/:monthYear",         downloadSalarySummary);
router.get("/salary/summary-excel/:monthYear",   downloadSalarySummaryExcel);
router.get("/salary/slips-excel/:monthYear",     downloadSalarySlipsExcel);

// Departments
router.get("/departments",      getDepartments);
router.post("/departments",     createDepartment);
router.put("/departments/:id",  updateDepartment);
router.delete("/departments/:id", deleteDepartment);

// Employees
router.get("/employees",      getEmployees);
router.post("/employees",     validate(createEmployeeSchema), createEmployee);
router.put("/employees/:id",  validate(updateEmployeeSchema), updateEmployee);
router.delete("/employees/:id", deleteEmployee);

// Attendance
router.post("/employees/:id/checkin",             checkInEmployee);
router.post("/employees/:id/checkout",            checkOutEmployee);
router.post("/employees/:id/attendance-records/:recordId/waive-half-day", waiveHalfDayDeduction);
router.post("/employees/:id/attendance-records/:recordId/waive-fine", waiveAttendanceFine);
router.post("/employees/:id/bonus",               validate(manualBonusSchema), addManualBonus);
router.delete("/employees/:id/sales-records/:salesRecordId", deleteSalesRecord);
router.post("/attendance/penalize-forgot-checkout", penalizeForgotCheckout);

// Leave requests
router.post("/employees/:id/leave",              validate(leaveRequestSchema), createLeaveRequest);
router.get("/employees/:id/leave",               getLeaveRequestsByEmployee);
router.get("/leave-requests",                    getLeaveRequests);
router.put("/leave-requests/:id/status",         validate(updateLeaveStatusSchema), updateLeaveRequestStatus);

export default router;
