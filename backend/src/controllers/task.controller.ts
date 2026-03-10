// src/controllers/task.controller.ts
import { Request, Response } from "express";
import { prisma } from "../../lib/prisma.js";
import { getIO } from "../socket.js";
// --- Tạo khách hàng mới ---
export const createTask = async (req: Request, res: Response) => {
  try {
    const { id, activities, columnId, processingColId, createdAt, ...taskData } = req.body;

    const newTaskId = `task-${Date.now()}`;

    const newTask = await prisma.task.create({
      data: {
        ...taskData,
        id: newTaskId,
        columnId: "col-1", 
        createdAt: createdAt ? new Date(createdAt) : new Date(),
      },
    });

    // PHÁT TÍN HIỆU REAL-TIME
    getIO().emit("data_changed");

    res.status(201).json(newTask);
  } catch (error) {
    console.error("Lỗi khi tạo Task:", error);
    res.status(500).json({ error: "Lỗi server khi tạo khách hàng mới" });
  }
};

// --- Cập nhật thông tin khách hàng ---
export const updateTask = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { activities, columnId, ...updateData } = req.body; 

    const updatedTask = await prisma.task.update({
      where: { id: id as string },
      data: updateData,
    });

    // PHÁT TÍN HIỆU REAL-TIME
    getIO().emit("data_changed");

    res.status(200).json(updatedTask);
  } catch (error) {
    console.error("Lỗi khi cập nhật Task:", error);
    res.status(500).json({ error: "Lỗi server khi cập nhật khách hàng" });
  }
};

// --- Xóa khách hàng ---
export const deleteTask = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.task.delete({
      where: { id: id as string },
    });

    // PHÁT TÍN HIỆU REAL-TIME
    getIO().emit("data_changed");

    res.status(200).json({ message: "Đã xóa khách hàng thành công" });
  } catch (error) {
    console.error("Lỗi khi xóa Task:", error);
    res.status(500).json({ error: "Lỗi server khi xóa khách hàng" });
  }
};

// --- Chuyển cột Kanban Sale (CRM) ---
export const moveTask = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { columnId } = req.body; 

    // 1. Lấy thông tin task TRƯỚC KHI chuyển cột để kiểm tra
    const oldTask = await prisma.task.findUnique({ where: { id: id as string } });
    if (!oldTask) return res.status(404).json({ error: "Không tìm thấy thẻ khách hàng" });

    // 2. Cập nhật vị trí cột mới
    const updatedTask = await prisma.task.update({
      where: { id: id as string },
      data: { columnId }, 
    });

    // ==========================================
    // 3. LOGIC TỰ ĐỘNG CỘNG HOA HỒNG (1.500.000 VNĐ)
    // Giả sử ID của cột "Đã ký" trong hệ thống của bạn là "col-4". 
    // (Nếu của bạn là col-3 hay col-5 thì sửa lại chỗ này nhé)
    // ==========================================
    if (columnId === "col-4" && oldTask.columnId !== "col-4" 
    && oldTask.assignedTo && !oldTask.commissionPaid) {
      
      // Tìm nhân viên Sale đang phụ trách thẻ này (Tìm bằng tên)
      const employee = await prisma.employee.findFirst({
        where: { name: oldTask.assignedTo }
      });

      if (employee) {
        // Tự động tạo 1 phiếu thưởng 1.500.000đ vào bảng lương của Sale đó
        await prisma.salesRecord.create({
          data: {
            employeeId: employee.id,
            customer: oldTask.content.split(" - ")[0] || "Khách hàng",
            service: oldTask.visaType || "Ký hợp đồng dịch vụ",
            profit: 1500000, // CỘNG CỨNG 1.5 TRIỆU
            note: "Hệ thống: Tự động ghi nhận khi chốt HĐ", 
          }
          
        });
         await prisma.task.update({
    where: { id: id as string },
    data: { commissionPaid: true }
  });
      }
    }

    // 4. Báo cho toàn hệ thống biết để reload lại giao diện
    getIO().emit("data_changed");
    res.status(200).json(updatedTask);
  } catch (error) {
    console.error("Lỗi khi kéo thả Kanban:", error);
    res.status(500).json({ error: "Lỗi hệ thống khi chuyển cột" });
  }
};

export const moveProcessingTask = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { processingColId } = req.body;

    const updatedTask = await prisma.task.update({
      where: { id: id as string },
      data: { processingColId }, // Lưu lại cột của BO
    });

    getIO().emit("data_changed"); // Báo cho các máy khác load lại Board
    res.json(updatedTask);
  } catch (error) {
    res.status(500).json({ error: "Lỗi khi chuyển cột xử lý" });
  }
};

// 2. API "Đòi hồ sơ" từ BO gửi cho Sale
export const sendNotification = async (req: Request, res: Response) => {
  try {
    const { customerName, saleName, sender, customMessage, taskId } = req.body;

    // Tìm Employee dựa vào tên Sale (hoặc bạn có thể truyền ID từ frontend lên cho chắc chắn)
    // Tạo thông báo vào DB
    const notif = await prisma.notification.create({
      data: {
        sender: sender,
        message: customMessage,
        receiver: [saleName], 
        taskId: taskId
      }
    });

    getIO().emit("data_changed");
    res.status(201).json(notif);
  } catch (error) {
    console.error("Lỗi khi gửi thông báo (từ BO đòi hồ sơ):", error);
    res.status(500).json({ error: "Lỗi khi gửi thông báo" });
  }
};