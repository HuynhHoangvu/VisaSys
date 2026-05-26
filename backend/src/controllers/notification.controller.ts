import { Request, Response } from "express";
import { getIO } from "../socket.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import {
  getNotificationsService,
  sendReminderService,
  sendExamSubmittedNotificationService,
  markAsReadService,
} from "../services/notification.service.js";

// Sale endpoint: fetch unread notifications for the current sale user.
export const getNotifications = asyncHandler(async (req: Request, res: Response) => {
  try {
    const { saleName } = req.params; // Read sale name from URL
    const notifs = await getNotificationsService(saleName as string);
    res.json(notifs);
  } catch (error) {
    res.status(500).json({ error: "Lỗi lấy thông báo" });
  }
});

// Manager endpoint: send a reminder notification.
export const sendReminder = asyncHandler(async (req: Request, res: Response) => {
  try {
    const { customerName, saleName, sender, customMessage, taskId } = req.body;
    
    // Log incoming payload for debugging.
    console.log("📩 Incoming payload:", req.body);

    const newNotif = await sendReminderService(customerName, saleName, sender, customMessage, taskId);

    getIO().emit("data_changed");
    res.status(201).json(newNotif);

  } catch (error) {
    // Log detailed error.
    console.error("❌ sendReminder error:", error);
    res.status(500).json({ error: "Lỗi gửi thông báo nhắc nhở" });
  }
});

// Exam system endpoint: notify management when a student submits a test.
export const sendExamSubmittedNotification = asyncHandler(async (req: Request, res: Response) => {
  try {
    const requiredWebhookToken = process.env.FLYVISA_WEBHOOK_TOKEN?.trim();
    if (requiredWebhookToken) {
      const incomingToken = (req.header("x-webhook-token") || "").trim();
      if (!incomingToken || incomingToken !== requiredWebhookToken) {
        return res.status(401).json({ error: "Webhook token không hợp lệ" });
      }
    }

    const { studentName, examName, score, submittedAt, sender } = req.body as {
      studentName: string;
      examName?: string;
      score?: string | number;
      submittedAt?: string;
      sender?: string;
    };

    const { newNotif, receivers } = await sendExamSubmittedNotificationService(
      studentName,
      examName,
      score,
      submittedAt,
      sender
    );

    getIO().emit("new_notification", {
      id: newNotif.id,
      sender: newNotif.sender,
      message: newNotif.message,
      receivers,
    });

    res.status(201).json({ success: true, receiversCount: receivers.length, id: newNotif.id });
  } catch (error: any) {
    if (error.message === "Không tìm thấy người nhận thuộc nhóm giáo viên") {
      return res.status(400).json({ error: error.message });
    }
    console.error("❌ sendExamSubmittedNotification error:", error);
    res.status(500).json({ error: "Lỗi gửi thông báo nộp bài thi" });
  }
});

// Sale endpoint: mark notification as read.
export const markAsRead = asyncHandler(async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await markAsReadService(id as string);
    getIO().emit("data_changed");
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Lỗi cập nhật thông báo" });
  }
});