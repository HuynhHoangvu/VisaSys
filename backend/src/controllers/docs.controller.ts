import { Request, Response } from "express";
import { prisma } from "../../lib/prisma.js";
import { getIO } from "../socket.js";
import fs from "fs";
import path from "path";
import { bucket, uploadToGCS } from "../middlewares/upload.js"; 

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
    const files = await prisma.docFile.findMany({ where: { folderId: id } });
    
    for (const file of files) {
      if (file.cloudinaryPublicId) {
        // Xóa trên Google Cloud
        await bucket.file(file.cloudinaryPublicId).delete().catch(() => console.log("Không tìm thấy file trên GCS"));
      } else if (file.fileUrl && file.fileUrl.startsWith("/uploads")) {
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

export const moveFolder = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { parentId } = req.body;
    if (id === parentId) return res.status(400).json({ error: "Không thể di chuyển thư mục vào chính nó" });

    const updatedFolder = await prisma.docFolder.update({ where: { id }, data: { parentId } });
    getIO().emit("docs_changed");
    res.json(updatedFolder);
  } catch (error) {
    res.status(500).json({ error: "Lỗi khi di chuyển thư mục" });
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

    const decodedName = Buffer.from(req.file.originalname, "latin1").toString("utf8");
    
    // Dùng chung hàm helper GCS vừa tạo (Lưu vào thư mục 'documents' trên bucket)
    const gcsResult = await uploadToGCS(req.file.path, "documents", decodedName);

    const newFile = await prisma.docFile.create({
      data: {
        name: decodedName, 
        size,
        uploadedBy,
        fileUrl: gcsResult.url,
        cloudinaryPublicId: gcsResult.publicId, // Lưu path của GCS vào cột này
        folderId,
      },
    });

    getIO().emit("docs_changed");
    res.status(201).json(newFile);
  } catch (error) {
    console.error("Lỗi upload GCS:", error);
    res.status(500).json({ error: "Lỗi hệ thống khi tải file lên Google Cloud" });
  }
};

export const deleteFile = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const file = await prisma.docFile.findUnique({ where: { id } });
    
    if (file) {
      if (file.cloudinaryPublicId) {
        await bucket.file(file.cloudinaryPublicId).delete().catch(() => console.log("File không tồn tại trên GCS"));
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

    const updatedFile = await prisma.docFile.update({ where: { id }, data: { name } });
    getIO().emit("docs_changed");
    res.json(updatedFile);
  } catch (error) {
    res.status(500).json({ error: "Lỗi khi đổi tên file" });
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
    res.status(500).json({ error: "Lỗi khi di chuyển file" });
  }
};