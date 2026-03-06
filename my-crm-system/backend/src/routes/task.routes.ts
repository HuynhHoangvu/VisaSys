// src/routes/task.routes.ts
import { Router } from "express";
import { createTask, deleteTask, moveProcessingTask, moveTask, updateTask } from "../controllers/task.controller.js";
import { uploadDoc } from "../middlewares/upload.js";

const router = Router();

// Endpoint: POST /api/tasks
router.post("/", createTask);
router.put("/:id", updateTask);         
router.delete("/:id", deleteTask);
router.put("/:id/move", moveTask);
router.put("/:id/processing-move", moveProcessingTask); 
router.post("/upload", uploadDoc.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "Không có file được tải lên" });
  }
  
  // DỊCH LẠI FONT TIẾNG VIỆT
  const decodedName = Buffer.from(req.file.originalname, "latin1").toString("utf8");

  // Trả về Tên gốc chuẩn tiếng Việt và Đường dẫn thật của file
  res.json({
    name: decodedName,
    url: `/uploads/documents/${req.file.filename}` 
  });
});
export default router;