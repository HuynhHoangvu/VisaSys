import { Request, Response } from "express";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { getBoardDataService } from "../services/board.service.js";

export const getBoardData = asyncHandler(async (_req: Request, res: Response) => {
  try {
    const data = await getBoardDataService();
    res.status(200).json(data);
  } catch (error) {
    console.error("Lỗi getBoardData:", error);
    res.status(500).json({ message: "Lỗi máy chủ nội bộ" });
  }
});