import { Request, Response } from "express";
import { prisma } from "../../lib/prisma.js";
import { getIO } from "../socket.js";
import fs from "fs";
import path from "path";

// --- XỬ LÝ THƯ MỤC ---
export const getFolders = async (req: Request, res: Response) => {
  try {
    const folders = await prisma.processedFolder.findMany({ orderBy: { createdAt: "desc" } });
    res.json(folders);
  } catch (error) {
    res.status(500).json({ error: "Lỗi lấy danh sách thư mục đã xử lý" });
  }
};

export const createFolder = async (req: Request, res: Response) => {
  try {
    const name = req.body.name as string;
    let parentId: string | null = null;
    
    if (typeof req.body.parentId === "string" && req.body.parentId !== "null") {
      parentId = req.body.parentId;
    }

    const newFolder = await prisma.processedFolder.create({
      data: { name, parentId },
    });
    
    // Đã đổi tên sự kiện socket
    getIO().emit("processed_docs_changed");
    res.status(201).json(newFolder);
  } catch (error) {
    res.status(500).json({ error: "Lỗi tạo thư mục đã xử lý" });
  }
};

export const deleteFolder = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    await prisma.processedFolder.delete({ where: { id } });
    
    getIO().emit("processed_docs_changed");
    res.json({ message: "Xóa thư mục thành công" });
  } catch (error) {
    res.status(500).json({ error: "Lỗi xóa thư mục" });
  }
};

// --- XỬ LÝ FILE TÀI LIỆU ---
export const getFiles = async (req: Request, res: Response) => {
  try {
    const files = await prisma.processedFile.findMany({ orderBy: { createdAt: "desc" } });
    res.json(files);
  } catch (error) {
    res.status(500).json({ error: "Lỗi lấy danh sách file đã xử lý" });
  }
};

export const uploadFile = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Chưa chọn file" });
    }

    const uploadedBy = (req.body.uploadedBy as string) || "Ẩn danh";
    const size = (req.body.size as string) || "0 KB";
    
    let folderId: string | null = null;
    if (typeof req.body.folderId === "string" && req.body.folderId !== "null") {
      folderId = req.body.folderId;
    } else if (Array.isArray(req.body.folderId)) {
      folderId = req.body.folderId[0] !== "null" ? req.body.folderId[0] : null;
    }

    // Vẫn dùng chung thư mục vật lý documents, bạn có thể đổi thành /uploads/processed_docs/ 
    // nếu có cấu hình multer (upload middleware) tách biệt.
    const fileUrl = `/uploads/processed_docs/${req.file.filename}`;

    const decodedName = Buffer.from(req.file.originalname, "latin1").toString("utf8");

    const newFile = await prisma.processedFile.create({
      data: {
        name: decodedName,
        size: size,
        uploadedBy: uploadedBy,
        fileUrl: fileUrl,
        folderId: folderId,
      },
    });

    getIO().emit("processed_docs_changed");
    res.status(201).json(newFile);
  } catch (error) {
    console.error("Lỗi upload:", error);
    res.status(500).json({ error: "Lỗi lưu file vào Database" });
  }
};

export const deleteFile = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    
    const file = await prisma.processedFile.findUnique({ where: { id } });
    if (file) {
      const filePath = path.join(process.cwd(), file.fileUrl);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath); 
      }
    }

    await prisma.processedFile.delete({ where: { id } });
    
    getIO().emit("processed_docs_changed");
    res.json({ message: "Xóa file thành công" });
  } catch (error) {
    res.status(500).json({ error: "Lỗi xóa file" });
  }
};