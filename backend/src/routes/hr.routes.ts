import { Router } from "express";
import { 
  getDepartments, 
  createDepartment, 
  getEmployees, 
  createEmployee, 
  deleteDepartment, 
  updateDepartment, 
  deleteEmployee, 
  checkInEmployee, 
  addManualBonus, 
  finalizeMonthSalary, 
  getSalaryHistory, 
  createLeaveRequest, 
  getLeaveRequests, 
  updateLeaveRequestStatus, 
  updateEmployee, 
  penalizeForgotCheckout, 
  checkOutEmployee, 
  downloadSalarySlip, 
  downloadSalarySummary, 
  downloadSalarySummaryExcel,
  downloadSalarySlipsExcel,
  getLeaveRequestsByEmployee,
  testSalaryCalculation,
  getSalaryBreakdown
} from "../controllers/hr.controller.js";

const router = Router();

// 1. API Chốt Lương
router.post("/salary/finalize", finalizeMonthSalary);
router.get("/salary/test/:employeeId/:monthYear", testSalaryCalculation);  // DEBUG: Test tính lương
router.get("/salary/slip/:employeeId/:monthYear", downloadSalarySlip);
router.get("/salary/summary/:monthYear", downloadSalarySummary);

router.get("/salary/summary-excel/:monthYear", downloadSalarySummaryExcel);
router.get("/salary/slips-excel/:monthYear", downloadSalarySlipsExcel);

router.get("/salary/history", getSalaryHistory);
router.get("/salary/breakdown/:monthYear", getSalaryBreakdown);

// 2. Routes Phòng Ban
router.get("/departments", getDepartments);
router.post("/departments", createDepartment);
router.put("/departments/:id", updateDepartment);
router.delete("/departments/:id", deleteDepartment);

// 3. Routes Nhân viên
router.get("/employees", getEmployees);
router.post("/employees", createEmployee);
router.put("/employees/:id", updateEmployee);
router.delete("/employees/:id", deleteEmployee);

// 4. API Thưởng/phạt & Điểm danh thủ công
router.post("/employees/:id/checkin", checkInEmployee);
router.post("/employees/:id/bonus", addManualBonus);
router.post("/employees/:id/checkout", checkOutEmployee);
router.post("/attendance/penalize-forgot-checkout", penalizeForgotCheckout);

// 5. Các API quản lý Đơn nghỉ phép
router.post("/employees/:id/leave", createLeaveRequest);
router.get("/employees/:id/leave", getLeaveRequestsByEmployee);
router.get("/leave-requests", getLeaveRequests);
router.put("/leave-requests/:id/status", updateLeaveRequestStatus);

export default router;