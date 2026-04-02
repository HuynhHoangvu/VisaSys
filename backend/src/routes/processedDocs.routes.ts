import { Router } from "express";
import {
  getFolders,
  createFolder,
  deleteFolder,
  renameFolder,
  moveFolder,
  getFiles,
  uploadFile,
  deleteFile,
  renameFile,
  moveFile,
} from "../controllers/processedDocs.controller.js";
import { uploadProcessedDoc } from "../middlewares/upload.js";

const router = Router();

// ==========================================
// ROUTES THƯ MỤC (FOLDERS)
// ==========================================
router.get("/folders", getFolders);
router.post("/folders", createFolder);
router.delete("/folders/:id", deleteFolder);
router.put("/folders/:id/rename", renameFolder);
router.put("/folders/:id/move", moveFolder); // Cập nhật vị trí thư mục (kéo thả)

// ==========================================
// ROUTES FILE
// ==========================================
router.get("/files", getFiles);
router.post("/files/upload", uploadProcessedDoc.single("file"), uploadFile);
router.delete("/files/:id", deleteFile);
router.put("/files/:id/rename", renameFile);
router.put("/files/:id/move", moveFile);     // Cập nhật thư mục cho file

export default router;