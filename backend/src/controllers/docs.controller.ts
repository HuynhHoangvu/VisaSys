import { Request, Response } from "express";
import { getIO } from "../socket.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import {
  getFoldersService,
  createFolderService,
  deleteFolderService,
  moveFolderService,
  renameFolderService,
  getFilesService,
  uploadFileService,
  deleteFileService,
  renameFileService,
  moveFileService,
} from "../services/docs.service.js";

export const getFolders = asyncHandler(async (_req: Request, res: Response) => {
  const folders = await getFoldersService();
  res.json(folders);
});

export const createFolder = asyncHandler(async (req: Request, res: Response) => {
  const name = req.body.name as string;
  let parentId: string | null = null;
  if (typeof req.body.parentId === "string" && req.body.parentId !== "null") {
    parentId = req.body.parentId;
  }
  
  const newFolder = await createFolderService(name, parentId);
  getIO().emit("docs_changed");
  res.status(201).json(newFolder);
});

export const deleteFolder = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  await deleteFolderService(id);
  getIO().emit("docs_changed");
  res.json({ message: "Folder deleted successfully" });
});

export const moveFolder = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { parentId } = req.body;
  try {
    const updatedFolder = await moveFolderService(id, parentId);
    getIO().emit("docs_changed");
    res.json(updatedFolder);
  } catch (error: any) {
    if (error.message === "Cannot move folder into itself") {
      return res.status(400).json({ error: error.message });
    }
    throw error;
  }
});

export const renameFolder = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { name } = req.body;
  try {
    const updatedFolder = await renameFolderService(id, name);
    getIO().emit("docs_changed");
    res.json(updatedFolder);
  } catch (error: any) {
    if (error.message === "Tên thư mục không được để trống") {
      return res.status(400).json({ error: error.message });
    }
    throw error;
  }
});

export const getFiles = asyncHandler(async (_req: Request, res: Response) => {
  const files = await getFilesService();
  res.json(files);
});

export const uploadFile = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) return res.status(400).json({ error: "No file selected" });

  const uploadedBy = (req.body.uploadedBy as string) || "Anonymous";
  const size = (req.body.size as string) || "0 KB";

  let folderId: string | null = null;
  if (typeof req.body.folderId === "string" && req.body.folderId !== "null") {
    folderId = req.body.folderId;
  } else if (Array.isArray(req.body.folderId)) {
    folderId = req.body.folderId[0] !== "null" ? req.body.folderId[0] : null;
  }

  try {
    const newFile = await uploadFileService({
      path: req.file.path,
      originalname: req.file.originalname,
      uploadedBy,
      size,
      folderId,
    });
    getIO().emit("docs_changed");
    res.status(201).json(newFile);
  } catch (error) {
    console.error("GCS upload error:", error);
    res.status(500).json({ error: "Failed to upload file to Google Cloud" });
  }
});

export const deleteFile = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  await deleteFileService(id);
  getIO().emit("docs_changed");
  res.json({ message: "File deleted successfully" });
});

export const renameFile = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { name } = req.body;
  try {
    const updatedFile = await renameFileService(id, name);
    getIO().emit("docs_changed");
    res.json(updatedFile);
  } catch (error: any) {
    if (error.message === "File name must not be empty") {
      return res.status(400).json({ error: error.message });
    }
    throw error;
  }
});

export const moveFile = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { folderId } = req.body;
  const updatedFile = await moveFileService(id, folderId);
  getIO().emit("docs_changed");
  res.json(updatedFile);
});