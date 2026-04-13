import { Router } from "express";
import { getFolders, createFolder, renameFile, renameFolder, deleteFolder, getFiles, uploadFile, deleteFile, moveFolder, moveFile } from "../controllers/docs.controller.js";
import { uploadDoc } from "../middlewares/upload.js";

const router = Router();
// Folders
router.get("/folders", getFolders);
router.post("/folders", createFolder);
router.delete("/folders/:id", deleteFolder);
router.put("/folders/:id/rename", renameFolder);
router.put("/folders/:id/move", moveFolder);
// Files
router.get("/files", getFiles);
router.post("/files/upload", uploadDoc.single("file"), uploadFile);
router.delete("/files/:id", deleteFile);
router.put("/files/:id/rename", renameFile);
router.put("/files/:id/move", moveFile);
export default router;