// src/routes/task.routes.ts
import { Router } from "express";
import { createTask, deleteTask, moveProcessingTask, moveTask, sendNotification, updateTask } from "../controllers/task.controller.js";
// Thêm uploadToCloudinary vào import từ file upload của bạn
import { uploadDoc, uploadToCloudinary } from "../middlewares/upload.js"; 
import { v2 as cloudinary } from "cloudinary";
const router = Router();
// Route chuyển cột BO
router.put("/:id/processing-move", moveProcessingTask);

// Route gửi thông báo (Nếu bạn có file notifications.routes.ts riêng thì để bên đó, nhớ đổi url cho khớp)
router.post("/notifications/send", sendNotification);
// Endpoint: POST /api/tasks
router.post("/", createTask);
router.put("/:id", updateTask);        
router.delete("/:id", deleteTask);
router.put("/:id/move", moveTask);
router.put("/:id/processing-move", moveProcessingTask); 

// ĐÃ SỬA: Thêm async vào callback và dùng uploadToCloudinary
router.post("/upload", uploadDoc.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Không có file được tải lên" });
    }
    
    // DỊCH LẠI FONT TIẾNG VIỆT
    const decodedName = Buffer.from(req.file.originalname, "latin1").toString("utf8");

    // Upload file buffer lên Cloudinary
    // Truyền vào: buffer, tên folder trên Cloudinary, tên file gốc
    const cloudinaryResult = await uploadToCloudinary(
      req.file.buffer, 
      "tasks-documents", 
      decodedName
    );

    // Trả về Tên gốc chuẩn tiếng Việt và URL an toàn từ Cloudinary
    res.status(201).json({
      name: decodedName,
      url: cloudinaryResult.url, // Đã đổi thành URL của Cloudinary
      publicId: cloudinaryResult.publicId 
    });
  } catch (error) {
    console.error("Lỗi upload task document lên Cloudinary:", error);
    res.status(500).json({ error: "Lỗi xử lý file đính kèm" });
  }
});
router.post("/remove-cloud-file", async (req, res) => {
  try {
    const { publicId } = req.body;
    if (!publicId) {
      return res.status(400).json({ error: "Thiếu publicId của file" });
    }

    // Nhớ có { resource_type: "raw" } vì ban nãy lúc upload mình set là "raw"
    await cloudinary.uploader.destroy(publicId, { resource_type: "raw" });
    
    res.json({ message: "Đã xoá file vĩnh viễn khỏi hệ thống" });
  } catch (error) {
    console.error("Lỗi xoá file Cloudinary:", error);
    res.status(500).json({ error: "Không thể xoá file" });
  }
});

export default router;