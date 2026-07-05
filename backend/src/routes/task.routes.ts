import { Router } from "express";
import { createTask, deleteTask, moveProcessingTask, moveTask, sendNotification, updateTask } from "../controllers/task.controller.js";
import { uploadDoc, uploadToGCS, bucket } from "../middlewares/upload.js"; 

const router = Router();

/**
 * @swagger
 * /api/tasks:
 *   post:
 *     tags: [Tasks]
 *     summary: Tạo hồ sơ khách hàng mới
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [content, phone, price, assignedTo]
 *             properties:
 *               content: { type: string, example: Nguyễn Văn A }
 *               phone: { type: string, example: "0901234567" }
 *               price: { type: string, example: "25000000" }
 *               source: { type: string, example: Giới thiệu }
 *               assignedTo: { type: string, example: Admin }
 *               columnId: { type: string, example: col-1 }
 *               visaType: { type: string, example: "Visa 500 - Du học" }
 *               checklistType: { type: string, enum: [tourism, labor, study] }
 *     responses:
 *       201:
 *         description: Tạo thành công
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Task' }
 */
router.post("/", createTask);

/**
 * @swagger
 * /api/tasks/{id}:
 *   put:
 *     tags: [Tasks]
 *     summary: Cập nhật hồ sơ khách hàng
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/Task' }
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 *   delete:
 *     tags: [Tasks]
 *     summary: Xoá hồ sơ khách hàng
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Đã xoá thành công
 */
router.put("/:id", updateTask);
router.delete("/:id", deleteTask);

/**
 * @swagger
 * /api/tasks/{id}/move:
 *   put:
 *     tags: [Tasks]
 *     summary: Di chuyển hồ sơ sang cột khác (Kanban drag & drop)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               columnId: { type: string }
 *               index: { type: number }
 *     responses:
 *       200:
 *         description: Di chuyển thành công
 */
router.put("/:id/move", moveTask);
router.put("/:id/processing-move", moveProcessingTask);
router.post("/notifications/send", sendNotification);

// UPLOAD TASK DOCUMENT
router.post("/upload", uploadDoc.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Không có file được tải lên" });
    }
    
    const decodedName = Buffer.from(req.file.originalname, "latin1").toString("utf8");

    const gcsResult = await uploadToGCS(
      req.file.path,
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

router.post("/remove-cloud-file", async (req, res) => {
  try {
    const { publicId } = req.body;
    if (!publicId) {
      return res.status(400).json({ error: "Thiếu publicId của file" });
    }

    await bucket.file(publicId).delete().catch(() => console.log("File không tồn tại trên GCS"));
    
    res.json({ message: "Đã xoá file vĩnh viễn khỏi hệ thống" });
  } catch (error) {
    console.error("Lỗi xoá file GCS:", error);
    res.status(500).json({ error: "Không thể xoá file" });
  }
});

export default router;