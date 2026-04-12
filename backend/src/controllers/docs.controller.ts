import { Request, Response } from "express";
import { prisma } from "../../lib/prisma.js";
import { getIO } from "../socket.js";
import fsPromises from "fs/promises";
import path from "path";
import { bucket, uploadToGCS } from "../middlewares/upload.js"; 

// Folder handling utilities.
const deleteLocalFile = async (fileUrl: string) => {
  if (!fileUrl.startsWith("/uploads")) return;
  const filePath = path.join(process.cwd(), fileUrl);
  try {
    await fsPromises.unlink(filePath);
  } catch {
      }
};

export const getFolders = async (_req: Request, res: Response) => {
  try {
    const folders = await prisma.docFolder.findMany({ orderBy: { createdAt: "desc" } });
    res.json(folders);
  } catch (error) {
    res.status(500).json({ error: "Failed to load folder list" });
  }
};

export const createFolder = async (req: Request, res: Response) => {
  try {
    const name = req.body.name as string;
    let parentId: string | null = null;
    if (typeof req.body.parentId === "string" && req.body.parentId !== "null") {
      parentId = req.body.parentId;
    }
    
    const newFolder = await prisma.docFolder.create({ data: { name, parentId } });
    getIO().emit("docs_changed");
    res.status(201).json(newFolder);
  } catch (error) {
    res.status(500).json({ error: "Failed to create folder" });
  }
};

export const deleteFolder = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const files = await prisma.docFile.findMany({ where: { folderId: id } });
    
    for (const file of files) {
      if (file.cloudinaryPublicId) {
        await bucket.file(file.cloudinaryPublicId).delete().catch(() => console.log("GCS file not found"));
      } else if (file.fileUrl) {
        await deleteLocalFile(file.fileUrl);
      }
    }

    await prisma.docFile.deleteMany({ where: { folderId: id } });
    await prisma.docFolder.delete({ where: { id } });

    getIO().emit("docs_changed");
    res.json({ message: "Folder deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete folder" });
  }
};

export const moveFolder = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { parentId } = req.body;
    if (id === parentId) return res.status(400).json({ error: "Cannot move folder into itself" });

    const updatedFolder = await prisma.docFolder.update({ where: { id }, data: { parentId } });
    getIO().emit("docs_changed");
    res.json(updatedFolder);
  } catch (error) {
    res.status(500).json({ error: "Failed to move folder" });
  }
};

// File handling utilities.
export const getFiles = async (_req: Request, res: Response) => {
  try {
    const files = await prisma.docFile.findMany({ orderBy: { createdAt: "desc" } });
    res.json(files);
  } catch (error) {
    res.status(500).json({ error: "Failed to load file list" });
  }
};

export const uploadFile = async (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file selected" });

    const uploadedBy = (req.body.uploadedBy as string) || "Anonymous";
    const size = (req.body.size as string) || "0 KB";

    let folderId: string | null = null;
    if (typeof req.body.folderId === "string" && req.body.folderId !== "null") {
      folderId = req.body.folderId;
    } else if (Array.isArray(req.body.folderId)) {
      folderId = req.body.folderId[0] !== "null" ? req.body.folderId[0] : null;
    }

    const decodedName = Buffer.from(req.file.originalname, "latin1").toString("utf8");
    
    // Use shared GCS helper and store the file in the 'documents' folder.
    const gcsResult = await uploadToGCS(req.file.path, "documents", decodedName);

    const newFile = await prisma.docFile.create({
      data: {
        name: decodedName, 
        size,
        uploadedBy,
        fileUrl: gcsResult.url,
        cloudinaryPublicId: gcsResult.publicId,
        folderId,
      },
    });

    getIO().emit("docs_changed");
    res.status(201).json(newFile);
  } catch (error) {
    console.error("GCS upload error:", error);
    res.status(500).json({ error: "Failed to upload file to Google Cloud" });
  }
};

export const deleteFile = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const file = await prisma.docFile.findUnique({ where: { id } });
    
    if (file) {
      if (file.cloudinaryPublicId) {
        await bucket.file(file.cloudinaryPublicId).delete().catch(() => console.log("GCS file not found"));
      } else if (file.fileUrl) {
        await deleteLocalFile(file.fileUrl);
      }
    }

    await prisma.docFile.delete({ where: { id } });
    getIO().emit("docs_changed");
    res.json({ message: "File deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete file" });
  }
};

export const renameFile = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: "File name must not be empty" });

    const updatedFile = await prisma.docFile.update({ where: { id }, data: { name } });
    getIO().emit("docs_changed");
    res.json(updatedFile);
  } catch (error) {
    res.status(500).json({ error: "Failed to rename file" });
  }
};

export const moveFile = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { folderId } = req.body;

    const updatedFile = await prisma.docFile.update({
      where: { id },
      data: { folderId: folderId === "null" ? null : folderId },
    });

    getIO().emit("docs_changed");
    res.json(updatedFile);
  } catch (error) {
    res.status(500).json({ error: "Failed to move file" });
  }
};

export const renameFolder = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: "Tên thư mục không được để trống" });

    const updatedFolder = await prisma.docFolder.update({ where: { id }, data: { name } });
    getIO().emit("docs_changed");
    res.json(updatedFolder);
  } catch (error) {
    res.status(500).json({ error: "Lỗi khi đổi tên thư mục" });
  }
};