import { Router } from "express";
import { getNotifications, sendReminder, markAsRead } from "../controllers/notification.controller.js";
const router = Router();
// Route cho Sếp gửi thông báo
router.post("/send", sendReminder);
// Route cho Sale lấy thông báo của riêng mình
router.get("/:saleName", getNotifications);
// Route đánh dấu đã đọc
router.put("/:id/read", markAsRead);
export default router;
