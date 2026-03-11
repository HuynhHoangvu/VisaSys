// src/routes/hr.routes.ts
import { Router } from "express";
import { getDepartments, createDepartment, getEmployees, createEmployee, deleteDepartment, updateDepartment, deleteEmployee, checkInEmployee, addManualBonus, finalizeMonthSalary, getSalaryHistory, createLeaveRequest, getLeaveRequests, updateLeaveRequestStatus, updateEmployee } from "../controllers/hr.controller.js";

const router = Router();

// 1. API Chốt Lương
router.post("/salary/finalize", finalizeMonthSalary)
router.get("/salary/history", getSalaryHistory);
// Routes Phòng Ban
router.get("/departments", getDepartments);
router.post("/departments", createDepartment);
router.put("/departments/:id", updateDepartment);
router.delete("/departments/:id", deleteDepartment);
// Routes Nhân viên

router.get("/employees", getEmployees);
router.post("/employees", createEmployee);
router.put("/employees/:id", updateEmployee);
router.delete("/employees/:id", deleteEmployee);
// Thêm Route này dành riêng cho Check-in
router.post("/employees/:id/checkin", checkInEmployee);
router.post("/employees/:id/bonus", addManualBonus);
// Thêm Route này dành riêng cho Check-out
router.post("/employees/:id/leave", createLeaveRequest);
// Các API quản lý Đơn nghỉ phép (Dành cho Sếp)
router.get("/leave-requests", getLeaveRequests);
router.put("/leave-requests/:id/status", updateLeaveRequestStatus);
export default router;