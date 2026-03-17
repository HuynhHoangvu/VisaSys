import { Request, Response } from "express";
import { prisma } from "../../lib/prisma.js";
import { getIO } from "../socket.js";
import fs from "fs";
import path from "path";
import { Readable } from "stream";
import { v2 as cloudinary } from "cloudinary";

// ==========================================
// CLOUDINARY CONFIG - lazy init
// ==========================================
const getCloudinary = () => {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  return cloudinary;
};

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
    const cld = getCloudinary();

    const files = await prisma.docFile.findMany({ where: { folderId: id } });
    for (const file of files) {
      if (file.cloudinaryPublicId) {
        await cld.uploader.destroy(file.cloudinaryPublicId, { resource_type: "raw" });
      } else if (file.fileUrl) {
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
const removeVietnameseTones = (str: string) => {
  return str
    .normalize('NFD') // Tách dấu ra khỏi ký tự
    .replace(/[\u0300-\u036f]/g, '') // Xóa các dấu
    .replace(/đ/g, 'd').replace(/Đ/g, 'D') // Đổi chữ đ
    .replace(/\s+/g, '_') // Thay khoảng trắng bằng dấu gạch dưới
    .replace(/[^a-zA-Z0-9._-]/g, ''); // Xóa toàn bộ các ký tự đặc biệt khác
};
export const uploadFile = async (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Chưa chọn file" });

    const cld = getCloudinary();
    const uploadedBy = (req.body.uploadedBy as string) || "An danh";
    const size = (req.body.size as string) || "0 KB";

    let folderId: string | null = null;
    if (typeof req.body.folderId === "string" && req.body.folderId !== "null") {
      folderId = req.body.folderId;
    } else if (Array.isArray(req.body.folderId)) {
      folderId = req.body.folderId[0] !== "null" ? req.body.folderId[0] : null;
    }

    // 1. Tên gốc (có dấu) để lưu vào Database (hiển thị cho người dùng xem)
    const decodedName = Buffer.from(req.file.originalname, "latin1").toString("utf8");
    
    // 2. Tên an toàn (không dấu) để làm URL trên Cloudinary
    const safeName = removeVietnameseTones(decodedName);

    const cloudinaryResult = await new Promise<any>((resolve, reject) => {
      const stream = cld.uploader.upload_stream(
        {
          folder: "flyvisa-documents",
          resource_type: "raw",
          // DÙNG safeName Ở ĐÂY THAY VÌ decodedName
          public_id: `${Date.now()}_${safeName}`, 
        },
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        }
      );

      Readable.from(req.file!.buffer).pipe(stream);
    });

    const newFile = await prisma.docFile.create({
      data: {
        name: decodedName, // Vẫn lưu tên gốc có dấu vào DB để giao diện hiện đẹp
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
    const cld = getCloudinary();

    const file = await prisma.docFile.findUnique({ where: { id } });
    if (file) {
      if (file.cloudinaryPublicId) {
        await cld.uploader.destroy(file.cloudinaryPublicId, { resource_type: "raw" });
      } else if (file.fileUrl && file.fileUrl.startsWith("/uploads")) {
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

export const renameFile = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { name } = req.body;

    if (!name) return res.status(400).json({ error: "Tên file không được để trống" });

    const updatedFile = await prisma.docFile.update({
      where: { id },
      data: { name },
    });

    getIO().emit("docs_changed");
    res.json(updatedFile);
  } catch (error) {
    res.status(500).json({ error: "Lỗi khi đổi tên file" });
  }
};
export const moveFolder = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string; // ID của thư mục bị kéo đi (VD: Úc 407)
    const { parentId } = req.body; // ID của thư mục đích (VD: Úc)

    if (id === parentId) {
      return res.status(400).json({ error: "Không thể di chuyển thư mục vào chính nó" });
    }

    const updatedFolder = await prisma.docFolder.update({
      where: { id },
      data: { parentId },
    });

    getIO().emit("docs_changed");
    res.json(updatedFolder);
  } catch (error) {
    console.error("Lỗi move folder:", error);
    res.status(500).json({ error: "Lỗi khi di chuyển thư mục" });
  }
};
export const moveFile = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { folderId } = req.body; // Sẽ là ID của thư mục đích, hoặc "null" nếu kéo ra ngoài cùng

    const updatedFile = await prisma.docFile.update({
      where: { id },
      data: { 
        folderId: folderId === "null" ? null : folderId 
      },
    });

    getIO().emit("docs_changed");
    res.json(updatedFile);
  } catch (error) {
    console.error("Lỗi move file:", error);
    res.status(500).json({ error: "Lỗi khi di chuyển file" });
  }
};