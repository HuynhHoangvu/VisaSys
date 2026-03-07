import { Request, Response } from "express";
import { prisma } from "../../lib/prisma.js";
import { getIO } from "../socket.js";
// 1. API Dành cho Sale: Lấy danh sách thông báo chưa đọc của mình
export const getNotifications = async (req: Request, res: Response) => {
  try {
    const { saleName } = req.params; // Lấy tên Sale từ URL
    const notifs = await prisma.notification.findMany({
      where: { 
        receiver: {
          has: saleName as string
        },
        isRead: false // Chỉ lấy tin chưa đọc
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(notifs);
  } catch (error) {
    res.status(500).json({ error: "Lỗi lấy thông báo" });
  }
};

// 2. API Dành cho Sếp: Bấm nút gửi lời nhắc
export const sendReminder = async (req: Request, res: Response) => {
    try {
        const { customerName, saleName, sender, customMessage, taskId } = req.body;
    
        // Nếu Sếp có nhập tin nhắn riêng thì dùng, không thì dùng mẫu mặc định
        const text = customMessage
            ? `Hồ sơ [${customerName}]: ${customMessage}`
            : `Hồ sơ khách hàng [${customerName}] đang cần xử lý gấp. Yêu cầu kiểm tra ngay!`;

        const newNotif = await prisma.notification.create({
            data: {
                sender: sender || "Ban Giám Đốc",
                message: text,
                receiver: saleName,
                taskId: taskId
            }
        });
      getIO().emit("data_changed");
        res.status(201).json(newNotif);
    } catch (error) {
        res.status(500).json({ error: "Lỗi gửi thông báo nhắc nhở" });
    }
};

// 3. API Dành cho Sale: Đánh dấu đã đọc
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