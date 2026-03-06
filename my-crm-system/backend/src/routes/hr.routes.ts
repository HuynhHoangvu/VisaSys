// src/routes/hr.routes.ts
import { Router } from "express";
import { getDepartments, createDepartment, getEmployees, createEmployee, deleteDepartment, updateDepartment, deleteEmployee, checkInEmployee, addManualBonus } from "../controllers/hr.controller.js";

const router = Router();

// Routes Phòng Ban
router.get("/departments", getDepartments);
router.post("/departments", createDepartment);
router.put("/departments/:id", updateDepartment);
router.delete("/departments/:id", deleteDepartment);
// Routes Nhân viên

router.get("/employees", getEmployees);
router.post("/employees", createEmployee);
router.delete("/employees/:id", deleteEmployee);
// Thêm Route này dành riêng cho Check-in
router.post("/employees/:id/checkin", checkInEmployee);
router.post("/employees/:id/bonus", addManualBonus);
export default router;