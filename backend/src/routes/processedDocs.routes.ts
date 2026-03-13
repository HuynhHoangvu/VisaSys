import { Router } from "express";
import {
  getFolders,
  createFolder,
  deleteFolder,
  getFiles,
  uploadFile,
  deleteFile,
  renameFile,
} from "../controllers/processedDocs.controller.js";
import { uploadProcessedDoc } from "../middlewares/upload.js";

const router = Router();

// Routes Thư mục
router.get("/folders", getFolders);
router.post("/folders", createFolder);
router.delete("/folders/:id", deleteFolder);

// Routes File
router.get("/files", getFiles);
router.post("/files/upload", uploadProcessedDoc.single("file"), uploadFile);
router.delete("/files/:id", deleteFile);
router.put("/files/:id/rename", renameFile);

export default router;