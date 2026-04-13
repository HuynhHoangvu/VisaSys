import { Router } from "express";
import { getNotifications, sendReminder, markAsRead } from "../controllers/notification.controller.js";

const router = Router();

router.post("/send", sendReminder);
router.get("/:saleName", getNotifications);
router.put("/:id/read", markAsRead);

export default router;