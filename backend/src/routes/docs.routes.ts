import { Router } from "express";
import { getFolders, createFolder,renameFile, deleteFolder, getFiles, uploadFile, deleteFile, moveFolder } from "../controllers/docs.controller.js";
import { uploadDoc } from "../middlewares/upload.js";

const router = Router();

// Routes Thư mục
router.get("/folders", getFolders);
router.post("/folders", createFolder);
router.delete("/folders/:id", deleteFolder);
router.put("/folders/:id/move", moveFolder);

// Routes File (Gắn middleware uploadDoc.single("file") vào đây)
router.get("/files", getFiles);
router.post("/files/upload", uploadDoc.single("file"), uploadFile);
router.delete("/files/:id", deleteFile);
router.put("/files/:id/rename", renameFile);
export default router;