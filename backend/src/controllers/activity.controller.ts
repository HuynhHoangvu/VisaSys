import { Request, Response } from "express";
import { getIO } from "../socket.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import {
  createActivityService,
  updateActivityService,
  deleteActivityService,
} from "../services/activity.service.js";

export const createActivity = asyncHandler(async (req: Request, res: Response) => {
  try {
    const newActivity = await createActivityService(req.body);
    getIO().emit("data_changed");
    res.status(201).json(newActivity);
  } catch (error) {
    console.error("Lỗi khi tạo Activity:", error);
    res.status(500).json({ error: "Lỗi server" });
  }
});

export const updateActivity = asyncHandler(async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { completed } = req.body;
    const updatedActivity = await updateActivityService(id as string, completed);
    getIO().emit("data_changed");
    res.status(200).json(updatedActivity);
  } catch (error) {
    res.status(500).json({ error: "Lỗi cập nhật" });
  }
});

export const deleteActivity = asyncHandler(async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await deleteActivityService(id as string);
    getIO().emit("data_changed");
    res.status(200).json({ message: "Xóa thành công" });
  } catch (error) {
    res.status(500).json({ error: "Lỗi xóa" });
  }
});