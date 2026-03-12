import { Request, Response } from "express";
import { prisma } from "../../lib/prisma.js";
import { getIO } from "../socket.js";
import { v2 as cloudinary } from "cloudinary";
import { Readable } from "stream";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Helper upload buffer lên Cloudinary
const uploadBufferToCloudinary = (buffer: Buffer, publicId: string): Promise<any> => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "flyvisa-processed-docs", resource_type: "raw", public_id: publicId },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    const readable = new Readable();
    readable.push(buffer);
    readable.push(null);
    readable.pipe(stream);
  });
};

// --- XỬ LÝ THƯ MỤC ---
export const getFolders = async (req: Request, res: Response) => {
  try {
    const folders = await prisma.processedFolder.findMany({ orderBy: { createdAt: "desc" } });
    res.json(folders);
  } catch (error) {
    res.status(500).json({ error: "Loi lay danh sach thu muc da xu ly" });
  }
};

export const createFolder = async (req: Request, res: Response) => {
  try {
    const name = req.body.name as string;
    let parentId: string | null = null;
    if (typeof req.body.parentId === "string" && req.body.parentId !== "null") {
      parentId = req.body.parentId;
    }
    const newFolder = await prisma.processedFolder.create({ data: { name, parentId } });
    getIO().emit("processed_docs_changed");
    res.status(201).json(newFolder);
  } catch (error) {
    res.status(500).json({ error: "Loi tao thu muc da xu ly" });
  }
};

export const deleteFolder = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    // Xóa file Cloudinary trước
    const files = await prisma.processedFile.findMany({ where: { folderId: id } });
    for (const file of files) {
      if ((file as any).cloudinaryPublicId) {
        await cloudinary.uploader.destroy((file as any).cloudinaryPublicId, { resource_type: "raw" });
      }
    }

    await prisma.processedFile.deleteMany({ where: { folderId: id } });
    await prisma.processedFolder.delete({ where: { id } });
    getIO().emit("processed_docs_changed");
    res.json({ message: "Xoa thu muc thanh cong" });
  } catch (error) {
    res.status(500).json({ error: "Loi xoa thu muc" });
  }
};

// --- XỬ LÝ FILE ---
export const getFiles = async (req: Request, res: Response) => {
  try {
    const files = await prisma.processedFile.findMany({ orderBy: { createdAt: "desc" } });
    res.json(files);
  } catch (error) {
    res.status(500).json({ error: "Loi lay danh sach file da xu ly" });
  }
};

export const uploadFile = async (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Chua chon file" });

    const uploadedBy = (req.body.uploadedBy as string) || "An danh";
    const size = (req.body.size as string) || "0 KB";

    let folderId: string | null = null;
    if (typeof req.body.folderId === "string" && req.body.folderId !== "null") {
      folderId = req.body.folderId;
    } else if (Array.isArray(req.body.folderId)) {
      folderId = req.body.folderId[0] !== "null" ? req.body.folderId[0] : null;
    }

    const decodedName = Buffer.from(req.file.originalname, "latin1").toString("utf8");
    const safeName = decodedName.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9._-]/g, "_");
    const publicId = `${Date.now()}_${safeName}`;

    // Upload buffer lên Cloudinary
    const result = await uploadBufferToCloudinary(req.file.buffer, publicId);

    const newFile = await prisma.processedFile.create({
      data: {
        name: decodedName,
        size,
        uploadedBy,
        fileUrl: result.secure_url,    
        folderId,
        cloudinaryPublicId: result.public_id  
      },
    });

    getIO().emit("processed_docs_changed");
    res.status(201).json(newFile);
  } catch (error) {
    console.error("Loi upload:", error);
    res.status(500).json({ error: "Loi upload file len Cloudinary" });
  }
};

export const deleteFile = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    const file = await prisma.processedFile.findUnique({ where: { id } });
    if (file && (file as any).cloudinaryPublicId) {
      await cloudinary.uploader.destroy((file as any).cloudinaryPublicId, { resource_type: "raw" });
    }

    await prisma.processedFile.delete({ where: { id } });
    getIO().emit("processed_docs_changed");
    res.json({ message: "Xoa file thanh cong" });
  } catch (error) {
    res.status(500).json({ error: "Loi xoa file" });
  }
};