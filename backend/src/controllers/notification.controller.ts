import { Request, Response } from "express";
import { prisma } from "../../lib/prisma.js";
import { getIO } from "../socket.js";
// Sale endpoint: fetch unread notifications for the current sale user.
export const getNotifications = async (req: Request, res: Response) => {
  try {
    const { saleName } = req.params; // Read sale name from URL
    const notifs = await prisma.notification.findMany({
      where: { 
        receiver:  { has: saleName as string }, 
        isRead: false // Only fetch unread notifications
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(notifs);
  } catch (error) {
    res.status(500).json({ error: "Lỗi lấy thông báo" });
  }
};

// Manager endpoint: send a reminder notification.
export const sendReminder = async (req: Request, res: Response) => {
    try {
        const { customerName, saleName, sender, customMessage, taskId } = req.body;
        
        // Log incoming payload for debugging.
        console.log("📩 Incoming payload:", req.body);
    
        const text = customMessage
            ? `Hồ sơ [${customerName}]: ${customMessage}`
            : `Hồ sơ khách hàng [${customerName}] đang cần xử lý gấp.`;

        const newNotif = await prisma.notification.create({
            data: {
                sender: sender || "Ban Giám Đốc",
                message: text,
                receiver: [saleName],
                taskId: taskId
            }
        });

        getIO().emit("data_changed");
        res.status(201).json(newNotif);

    } catch (error) {
        // Log detailed error.
        console.error("❌ sendReminder error:", error);
        res.status(500).json({ error: "Lỗi gửi thông báo nhắc nhở" });
    }
};

// Exam system endpoint: notify management when a student submits a test.
export const sendExamSubmittedNotification = async (req: Request, res: Response) => {
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

    const teacherUsers = await prisma.employee.findMany({
      where: {
        department: {
          name: { contains: "giáo viên", mode: "insensitive" },
        },
      },
      select: { name: true },
    });

    const receivers = [...new Set(teacherUsers.map((u) => u.name).filter(Boolean))];
    if (receivers.length === 0) {
      return res.status(400).json({ error: "Không tìm thấy người nhận thuộc nhóm giáo viên" });
    }

    const scoreText = score !== undefined && score !== null && `${score}`.trim() !== ""
      ? ` | Điểm: ${score}`
      : "";
    const examText = examName?.trim() ? `Bài: ${examName.trim()} | ` : "";
    const timeText = submittedAt?.trim()
      ? ` | Lúc: ${submittedAt.trim()}`
      : ` | Lúc: ${new Date().toLocaleString("vi-VN")}`;

    const safeStudentName = studentName.trim();
    const message = `${examText}Học viên ${safeStudentName} đã nộp bài${scoreText}${timeText}`;

    const newNotif = await prisma.notification.create({
      data: {
        sender: sender?.trim() || "Fly Test System",
        message,
        receiver: receivers,
      },
    });

    getIO().emit("new_notification", {
      id: newNotif.id,
      sender: newNotif.sender,
      message: newNotif.message,
      receivers,
    });

    res.status(201).json({ success: true, receiversCount: receivers.length, id: newNotif.id });
  } catch (error) {
    console.error("❌ sendExamSubmittedNotification error:", error);
    res.status(500).json({ error: "Lỗi gửi thông báo nộp bài thi" });
  }
};

// Sale endpoint: mark notification as read.
export const markAsRead = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.notification.update({
      where: { id: id as string },
      data: { isRead: true }
    });
    getIO().emit("data_changed");
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Lỗi cập nhật thông báo" });
  }
};