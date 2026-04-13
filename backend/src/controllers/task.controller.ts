import { Request, Response } from "express";
import { prisma } from "../../lib/prisma.js";
import { getIO } from "../socket.js";
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
    getIO().emit("data_changed");
    res.status(201).json(newTask);
  } catch (error) {
    console.error("Lỗi khi tạo Task:", error);
    res.status(500).json({ error: "Lỗi server khi tạo khách hàng mới" });
  }
};
export const updateTask = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { activities, columnId, ...updateData } = req.body; 

    const updatedTask = await prisma.task.update({
      where: { id: id as string },
      data: updateData,
    });
    getIO().emit("data_changed");
    res.status(200).json(updatedTask);
  } catch (error) {
    console.error("Lỗi khi cập nhật Task:", error);
    res.status(500).json({ error: "Lỗi server khi cập nhật khách hàng" });
  }
};
export const deleteTask = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.task.delete({
      where: { id: id as string },
    });
    getIO().emit("data_changed");
    res.status(200).json({ message: "Đã xóa khách hàng thành công" });
  } catch (error) {
    console.error("Lỗi khi xóa Task:", error);
    res.status(500).json({ error: "Lỗi server khi xóa khách hàng" });
  }
};
export const moveTask = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { columnId } = req.body; 
    const oldTask = await prisma.task.findUnique({ where: { id: id as string } });
    if (!oldTask) return res.status(404).json({ error: "Không tìm thấy thẻ khách hàng" });
    const updatedTask = await prisma.task.update({
      where: { id: id as string },
      data: { columnId }, 
    });

    // ==========================================
    // 3. Commission automation logic for signed tasks.
    // Assumes the signed column id is "col-4".
    // Adjust this if your signed column is different.
    // ==========================================
    if (columnId === "col-4" && oldTask.columnId !== "col-4" 
    && oldTask.assignedTo && !oldTask.commissionPaid) {
      
      // Find the sale employee assigned to this task by name.
      const employee = await prisma.employee.findFirst({
        where: { name: oldTask.assignedTo }
      });

      if (employee) {
         await prisma.task.update({
    where: { id: id as string },
    data: { commissionPaid: true }
  });
      }
    }
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
      data: { processingColId },
    });
    getIO().emit("data_changed"); 
    res.json(updatedTask);
  } catch (error) {
    res.status(500).json({ error: "Lỗi khi chuyển cột xử lý" });
  }
};

export const sendNotification = async (req: Request, res: Response) => {
  try {
    const { saleName, sender, customMessage, taskId } = req.body;
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