import { Request, Response } from "express";
import { getIO } from "../socket.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import {
  createTaskService,
  updateTaskService,
  deleteTaskService,
  moveTaskService,
  moveProcessingTaskService,
  sendNotificationService,
} from "../services/task.service.js";

export const createTask = asyncHandler(async (req: Request, res: Response) => {
  try {
    const { id, activities, columnId, processingColId, createdAt, ...taskData } = req.body;
    const newTask = await createTaskService(taskData, createdAt);
    getIO().emit("data_changed");
    res.status(201).json(newTask);
  } catch (error) {
    console.error("Lỗi khi tạo Task:", error);
    res.status(500).json({ error: "Lỗi server khi tạo khách hàng mới" });
  }
});

export const updateTask = asyncHandler(async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { activities, columnId, ...updateData } = req.body; 
    const updatedTask = await updateTaskService(id as string, updateData);
    getIO().emit("data_changed");
    res.status(200).json(updatedTask);
  } catch (error) {
    console.error("Lỗi khi cập nhật Task:", error);
    res.status(500).json({ error: "Lỗi server khi cập nhật khách hàng" });
  }
});

export const deleteTask = asyncHandler(async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await deleteTaskService(id as string);
    getIO().emit("data_changed");
    res.status(200).json({ message: "Đã xóa khách hàng thành công" });
  } catch (error) {
    console.error("Lỗi khi xóa Task:", error);
    res.status(500).json({ error: "Lỗi server khi xóa khách hàng" });
  }
});

export const moveTask = asyncHandler(async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { columnId } = req.body; 
    const updatedTask = await moveTaskService(id as string, columnId);
    getIO().emit("data_changed");
    res.status(200).json(updatedTask);
  } catch (error: any) {
    if (error.message === "Không tìm thấy thẻ khách hàng") {
      return res.status(404).json({ error: error.message });
    }
    console.error("Lỗi khi kéo thả Kanban:", error);
    res.status(500).json({ error: "Lỗi hệ thống khi chuyển cột" });
  }
});

export const moveProcessingTask = asyncHandler(async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { processingColId } = req.body;
    const updatedTask = await moveProcessingTaskService(id as string, processingColId);
    getIO().emit("data_changed"); 
    res.json(updatedTask);
  } catch (error) {
    res.status(500).json({ error: "Lỗi khi chuyển cột xử lý" });
  }
});

export const sendNotification = asyncHandler(async (req: Request, res: Response) => {
  try {
    const { saleName, sender, customMessage, taskId } = req.body;
    const notif = await sendNotificationService(saleName, sender, customMessage, taskId);
    getIO().emit("data_changed");
    res.status(201).json(notif);
  } catch (error) {
    console.error("Lỗi khi gửi thông báo (từ BO đòi hồ sơ):", error);
    res.status(500).json({ error: "Lỗi khi gửi thông báo" });
  }
});