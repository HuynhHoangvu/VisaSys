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