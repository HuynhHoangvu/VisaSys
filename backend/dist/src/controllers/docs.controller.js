import { prisma } from "../../lib/prisma.js";
import { getIO } from "../socket.js";
import fs from "fs";
import path from "path";
// --- XỬ LÝ THƯ MỤC ---
export const getFolders = async (req, res) => {
    try {
        const folders = await prisma.docFolder.findMany({ orderBy: { createdAt: "desc" } });
        res.json(folders);
    }
    catch (error) {
        res.status(500).json({ error: "Lỗi lấy danh sách thư mục" });
    }
};
export const createFolder = async (req, res) => {
    try {
        const name = req.body.name;
        let parentId = null;
        if (typeof req.body.parentId === "string" && req.body.parentId !== "null") {
            parentId = req.body.parentId;
        }
        const newFolder = await prisma.docFolder.create({
            data: { name, parentId },
        });
        getIO().emit("docs_changed");
        res.status(201).json(newFolder);
    }
    catch (error) {
        res.status(500).json({ error: "Lỗi tạo thư mục" });
    }
};
export const deleteFolder = async (req, res) => {
    try {
        const id = req.params.id;
        await prisma.docFolder.delete({ where: { id } });
        getIO().emit("docs_changed");
        res.json({ message: "Xóa thư mục thành công" });
    }
    catch (error) {
        res.status(500).json({ error: "Lỗi xóa thư mục" });
    }
};
// --- XỬ LÝ FILE TÀI LIỆU ---
export const getFiles = async (req, res) => {
    try {
        const files = await prisma.docFile.findMany({ orderBy: { createdAt: "desc" } });
        res.json(files);
    }
    catch (error) {
        res.status(500).json({ error: "Lỗi lấy danh sách file" });
    }
};
export const uploadFile = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "Chưa chọn file" });
        }
        const uploadedBy = req.body.uploadedBy || "Ẩn danh";
        const size = req.body.size || "0 KB";
        let folderId = null;
        if (typeof req.body.folderId === "string" && req.body.folderId !== "null") {
            folderId = req.body.folderId;
        }
        else if (Array.isArray(req.body.folderId)) {
            folderId = req.body.folderId[0] !== "null" ? req.body.folderId[0] : null;
        }
        const fileUrl = `/uploads/documents/${req.file.filename}`;
        // ĐÃ THÊM: Dịch lại Font tiếng Việt trước khi lưu vào Database
        const decodedName = Buffer.from(req.file.originalname, "latin1").toString("utf8");
        const newFile = await prisma.docFile.create({
            data: {
                name: decodedName, // Lưu tên chuẩn tiếng Việt
                size: size,
                uploadedBy: uploadedBy,
                fileUrl: fileUrl,
                folderId: folderId,
            },
        });
        getIO().emit("docs_changed");
        res.status(201).json(newFile);
    }
    catch (error) {
        console.error("Lỗi upload:", error);
        res.status(500).json({ error: "Lỗi lưu file vào Database" });
    }
};
export const deleteFile = async (req, res) => {
    try {
        const id = req.params.id;
        const file = await prisma.docFile.findUnique({ where: { id } });
        if (file) {
            const filePath = path.join(process.cwd(), file.fileUrl);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }
        await prisma.docFile.delete({ where: { id } });
        getIO().emit("docs_changed");
        res.json({ message: "Xóa file thành công" });
    }
    catch (error) {
        res.status(500).json({ error: "Lỗi xóa file" });
    }
};
