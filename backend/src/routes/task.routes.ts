import { Router } from "express";
import { createTask, deleteTask, moveProcessingTask, moveTask, sendNotification, updateTask } from "../controllers/task.controller.js";
// Thêm uploadToGCS và bucket từ file upload của bạn
import { uploadDoc, uploadToGCS, bucket } from "../middlewares/upload.js"; 

const router = Router();

router.put("/:id/processing-move", moveProcessingTask);
router.post("/notifications/send", sendNotification);
router.post("/", createTask);
router.put("/:id", updateTask);        
router.delete("/:id", deleteTask);
router.put("/:id/move", moveTask);
router.put("/:id/processing-move", moveProcessingTask); 

// UPLOAD TASK DOCUMENT
router.post("/upload", uploadDoc.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Không có file được tải lên" });
    }
    
    const decodedName = Buffer.from(req.file.originalname, "latin1").toString("utf8");

    // Upload file buffer lên Google Cloud
    const gcsResult = await uploadToGCS(
      req.file.buffer, 
      "tasks-documents", 
      decodedName
    );

    res.status(201).json({
      name: decodedName,
      url: gcsResult.url, 
      publicId: gcsResult.publicId 
    });
  } catch (error) {
    console.error("Lỗi upload task document lên GCS:", error);
    res.status(500).json({ error: "Lỗi xử lý file đính kèm" });
  }
});

// XÓA TASK DOCUMENT
router.post("/remove-cloud-file", async (req, res) => {
  try {
    const { publicId } = req.body;
    if (!publicId) {
      return res.status(400).json({ error: "Thiếu publicId của file" });
    }

    // Xóa file trên Google Cloud
    await bucket.file(publicId).delete().catch(() => console.log("File không tồn tại trên GCS"));
    
    res.json({ message: "Đã xoá file vĩnh viễn khỏi hệ thống" });
  } catch (error) {
    console.error("Lỗi xoá file GCS:", error);
    res.status(500).json({ error: "Không thể xoá file" });
  }
});

export default router;