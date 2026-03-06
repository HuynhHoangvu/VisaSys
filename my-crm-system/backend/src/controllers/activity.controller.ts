import { Request, Response } from "express";
import { prisma } from "../../lib/prisma.js";
import { getIO } from "../socket.js";

export const createActivity = async (req: Request, res: Response) => {
  try {
    const { taskId, type, summary, assignee, status, completed, dueText, fileName, fileUrl } = req.body;
    const newActivity = await prisma.activity.create({
      data: {
        id: `act-${Date.now()}`,
        taskId, type, summary, assignee, status,
        completed: completed || false,
        dueText, fileName, fileUrl,
        createdAt: new Date().toISOString(),
      },
    });

    getIO().emit("data_changed"); // PHÁT TÍN HIỆU
    res.status(201).json(newActivity);
  } catch (error) {
    console.error("Lỗi khi tạo Activity:", error);
    res.status(500).json({ error: "Lỗi server" });
  }
};

export const updateActivity = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { completed } = req.body; 
    const updatedActivity = await prisma.activity.update({
      where: { id: id as string },
      data: { completed },
    });

    getIO().emit("data_changed"); // PHÁT TÍN HIỆU
    res.status(200).json(updatedActivity);
  } catch (error) {
    res.status(500).json({ error: "Lỗi cập nhật" });
  }
};

export const deleteActivity = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.activity.delete({ where: { id: id as string } });

    getIO().emit("data_changed"); // PHÁT TÍN HIỆU
    res.status(200).json({ message: "Xóa thành công" });
  } catch (error) {
    res.status(500).json({ error: "Lỗi xóa" });
  }
};