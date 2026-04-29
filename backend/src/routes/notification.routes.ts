import { Router } from "express";
import { getNotifications, sendReminder, markAsRead, sendExamSubmittedNotification } from "../controllers/notification.controller.js";
import { validate } from "../middlewares/validate.js";
import { examSubmittedNotificationSchema } from "../schemas/index.js";

const router = Router();

router.post("/send", sendReminder);
router.post("/exam-submitted", validate(examSubmittedNotificationSchema), sendExamSubmittedNotification);
router.get("/:saleName", getNotifications);
router.put("/:id/read", markAsRead);

export default router;