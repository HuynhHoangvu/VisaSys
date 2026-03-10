import { Router } from "express";
import { 
  getFolders, 
  createFolder, 
  deleteFolder, 
  getFiles, 
  uploadFile, 
  deleteFile 
} from "../controllers/processedDocs.controller.js";
import { uploadDoc, uploadProcessedDoc } from "../middlewares/upload.js"; // Dùng chung middleware upload hiện tại

const router = Router();

// Routes Thư mục
router.get("/folders", getFolders);
router.post("/folders", createFolder);
router.delete("/folders/:id", deleteFolder);

// Routes File
router.get("/files", getFiles);
router.post("/files/upload", uploadProcessedDoc.single("file"), uploadFile);
router.delete("/files/:id", deleteFile);

export default router;