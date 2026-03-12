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

    const uploadedBy = (req.body.uploadedBy as string) || "An danh";
    const size = (req.body.size as string) || "0 KB";

    let folderId: string | null = null;
    if (typeof req.body.folderId === "string" && req.body.folderId !== "null") {
      folderId = req.body.folderId;
    } else if (Array.isArray(req.body.folderId)) {
      folderId = req.body.folderId[0] !== "null" ? req.body.folderId[0] : null;
    }

    const decodedName = Buffer.from(req.file.originalname, "latin1").toString("utf8");

    // Upload từ buffer thay vì file.path
    const cloudinaryResult = await new Promise<any>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: "flyvisa-documents",
          resource_type: "raw",
          public_id: `${Date.now()}_${decodedName.replace(/\s+/g, "_")}`,
        },
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        }
      );
      const { Readable } = require("stream");
      const readable = new Readable();
      readable.push(req.file!.buffer);
      readable.push(null);
      readable.pipe(stream);
    });

    const newFile = await prisma.docFile.create({
      data: {
        name: decodedName,
        size,
        uploadedBy,
        fileUrl: cloudinaryResult.secure_url,
        cloudinaryPublicId: cloudinaryResult.public_id,
        folderId,
      },
    });

    getIO().emit("docs_changed");
    res.status(201).json(newFile);
  } catch (error) {
    console.error("Loi upload Cloudinary:", error);
    res.status(500).json({ error: "Loi upload file len Cloudinary" });
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