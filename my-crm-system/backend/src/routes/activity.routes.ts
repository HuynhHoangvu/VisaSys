// src/routes/activity.routes.ts
import { Router } from "express";
import { createActivity, updateActivity, deleteActivity } from "../controllers/activity.controller.js";

const router = Router();

router.post("/", createActivity);           // Thêm mới
router.put("/:id", updateActivity);         // Cập nhật (Tích xanh)
router.delete("/:id", deleteActivity);      // Xóa

export default router;