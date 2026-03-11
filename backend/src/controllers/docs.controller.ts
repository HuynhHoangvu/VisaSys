import { Request, Response } from "express";
import { prisma } from "../../lib/prisma.js";
import { getIO } from "../socket.js";
import fs from "fs";
import path from "path";
import { v2 as cloudinary } from "cloudinary";

// ==========================================
// CLOUDINARY CONFIG
// ==========================================
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ==========================================
// XỬ LÝ THƯ MỤC
// ==========================================
export const getFolders = async (req: Request, res: Response) => {
  try {
    const folders = await prisma.docFolder.findMany({ orderBy: { createdAt: "desc" } });
    res.json(folders);
  } catch (error) {
    res.status(500).json({ error: "Lỗi lấy danh sách thư mục" });
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
    res.status(500).json({ error: "Lỗi tạo thư mục" });
  }
};

export const deleteFolder = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    // Xóa file trên Cloudinary + DB trước khi xóa thư mục
    const files = await prisma.docFile.findMany({ where: { folderId: id } });
    for (const file of files) {
      if (file.cloudinaryPublicId) {
        // Xóa trên Cloudinary
        await cloudinary.uploader.destroy(file.cloudinaryPublicId, { resource_type: "raw" });
      } else if (file.fileUrl) {
        // Fallback: xóa file local nếu có
        const filePath = path.join(process.cwd(), file.fileUrl);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      }
    }

    await prisma.docFile.deleteMany({ where: { folderId: id } });
    await prisma.docFolder.delete({ where: { id } });

    getIO().emit("docs_changed");
    res.json({ message: "Xóa thư mục thành công" });
  } catch (error) {
    res.status(500).json({ error: "Lỗi xóa thư mục" });
  }
};

// ==========================================
// XỬ LÝ FILE
// ==========================================
export const getFiles = async (req: Request, res: Response) => {
  try {
    const files = await prisma.docFile.findMany({ orderBy: { createdAt: "desc" } });
    res.json(files);
  } catch (error) {
    res.status(500).json({ error: "Lỗi lấy danh sách file" });
  }
};

export const uploadFile = async (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Chưa chọn file" });

    const uploadedBy = (req.body.uploadedBy as string) || "Ẩn danh";
    const size = (req.body.size as string) || "0 KB";

    let folderId: string | null = null;
    if (typeof req.body.folderId === "string" && req.body.folderId !== "null") {
      folderId = req.body.folderId;
    } else if (Array.isArray(req.body.folderId)) {
      folderId = req.body.folderId[0] !== "null" ? req.body.folderId[0] : null;
    }

    // Decode tên tiếng Việt
    const decodedName = Buffer.from(req.file.originalname, "latin1").toString("utf8");

    // ==========================================
    // UPLOAD LÊN CLOUDINARY
    // ==========================================
    const cloudinaryResult = await cloudinary.uploader.upload(req.file.path, {
      folder: "flyvisa-documents",      // Lưu vào thư mục flyvisa-documents trên Cloudinary
      public_id: `${Date.now()}_${req.file.filename}`,
      resource_type: "raw",             // "raw" để hỗ trợ PDF, Word, Excel...
      use_filename: true,
      unique_filename: false,
    });

    // Xóa file tạm trên server sau khi upload lên Cloudinary xong
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    // Lưu vào DB với URL từ Cloudinary
    const newFile = await prisma.docFile.create({
      data: {
        name: decodedName,
        size: size,
        uploadedBy: uploadedBy,
        fileUrl: cloudinaryResult.secure_url,         // URL Cloudinary
        cloudinaryPublicId: cloudinaryResult.public_id, // Lưu để xóa sau này
        folderId: folderId,
      },
    });

    getIO().emit("docs_changed");
    res.status(201).json(newFile);
  } catch (error) {
    console.error("Lỗi upload Cloudinary:", error);
    res.status(500).json({ error: "Lỗi upload file lên Cloudinary" });
  }
};

export const deleteFile = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    const file = await prisma.docFile.findUnique({ where: { id } });
    if (file) {
      if (file.cloudinaryPublicId) {
        // Xóa trên Cloudinary
        await cloudinary.uploader.destroy(file.cloudinaryPublicId, { resource_type: "raw" });
      } else if (file.fileUrl && file.fileUrl.startsWith("/uploads")) {
        // Fallback: xóa file local cũ nếu có
        const filePath = path.join(process.cwd(), file.fileUrl);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      }
    }

    await prisma.docFile.delete({ where: { id } });
    getIO().emit("docs_changed");
    res.json({ message: "Xóa file thành công" });
  } catch (error) {
    res.status(500).json({ error: "Lỗi xóa file" });
  }
};