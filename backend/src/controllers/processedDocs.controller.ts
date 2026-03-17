import { Request, Response } from "express";
import { prisma } from "../../lib/prisma.js";
import { getIO } from "../socket.js";
import { bucket, uploadToGCS } from "../middlewares/upload.js"; // Import từ file upload

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
    if (typeof req.body.parentId === "string" && req.body.parentId !== "null") parentId = req.body.parentId;
    
    const newFolder = await prisma.processedFolder.create({ data: { name, parentId } });
    getIO().emit("docs_changed");
    res.status(201).json(newFolder);
  } catch (error) {
    res.status(500).json({ error: "Lỗi tạo thư mục" });
  }
};

export const deleteFolder = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const files = await prisma.processedFile.findMany({ where: { folderId: id } });
    
    for (const file of files) {
      if ((file as any).cloudinaryPublicId) {
        await bucket.file((file as any).cloudinaryPublicId).delete().catch(()=>console.log("Khong thay file tren GCS"));
      }
    }

    await prisma.processedFile.deleteMany({ where: { folderId: id } });
    await prisma.processedFolder.delete({ where: { id } });
    getIO().emit("docs_changed");
    res.json({ message: "Xóa thư mục thành công" });
  } catch (error) {
    res.status(500).json({ error: "Lỗi xóa thư mục" });
  }
};

// --- XỬ LÝ FILE ---
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
    if (!req.file) return res.status(400).json({ error: "Chưa chọn file" });

    const uploadedBy = (req.body.uploadedBy as string) || "Ẩn danh";
    const size = (req.body.size as string) || "0 KB";

    let folderId: string | null = null;
    if (typeof req.body.folderId === "string" && req.body.folderId !== "null") folderId = req.body.folderId;
    else if (Array.isArray(req.body.folderId)) folderId = req.body.folderId[0] !== "null" ? req.body.folderId[0] : null;

    const decodedName = Buffer.from(req.file.originalname, "latin1").toString("utf8");

    // Dùng chung hàm uploadToGCS
    const result = await uploadToGCS(req.file.buffer, "flyvisa-processed-docs", decodedName);

    const newFile = await prisma.processedFile.create({
      data: {
        name: decodedName,
        size,
        uploadedBy,
        fileUrl: result.url,
        folderId,
        cloudinaryPublicId: result.publicId, // Lưu tên file GCS
      },
    });

    getIO().emit("docs_changed");
    res.status(201).json(newFile);
  } catch (error) {
    console.error("Lỗi upload GCS:", error);
    res.status(500).json({ error: "Lỗi upload file lên Google Cloud" });
  }
};

export const deleteFile = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const file = await prisma.processedFile.findUnique({ where: { id } });
    
    if (file && (file as any).cloudinaryPublicId) {
      await bucket.file((file as any).cloudinaryPublicId).delete().catch(()=>console.log("Khong the xoa GCS file"));
    }

    await prisma.processedFile.delete({ where: { id } });
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

    const updatedFile = await prisma.processedFile.update({ where: { id }, data: { name } });
    getIO().emit("docs_changed");
    res.json(updatedFile);
  } catch (error) {
    res.status(500).json({ error: "Lỗi khi đổi tên file" });
  }
};