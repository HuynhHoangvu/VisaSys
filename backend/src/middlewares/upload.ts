import multer from "multer";
import fs from "fs";
import path from "path";

// ==========================================
// 1. CẤU HÌNH CHO TÀI LIỆU CÔNG TY DÙNG CHUNG
// ==========================================
const docDir = path.join(process.cwd(), "uploads", "documents");
if (!fs.existsSync(docDir)) {
  fs.mkdirSync(docDir, { recursive: true });
}

const docStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, docDir);
  },
  filename: (req, file, cb) => {
    const decodedName = Buffer.from(file.originalname, "latin1").toString("utf8");
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const safeName = decodedName.replace(/\s+/g, "_");
    cb(null, uniqueSuffix + "-" + safeName);
  },
});

export const uploadDoc = multer({
  storage: docStorage,
  limits: { fileSize: 50 * 1024 * 1024 }, 
});

// ==========================================
// 2. CẤU HÌNH CHO HỒ SƠ ĐÃ XỬ LÝ (PHÒNG XỬ LÝ)
// ==========================================
const processedDir = path.join(process.cwd(), "uploads", "processed_docs");
if (!fs.existsSync(processedDir)) {
  fs.mkdirSync(processedDir, { recursive: true });
}

const processedStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, processedDir);
  },
  filename: (req, file, cb) => {
    const decodedName = Buffer.from(file.originalname, "latin1").toString("utf8");
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const safeName = decodedName.replace(/\s+/g, "_");
    cb(null, uniqueSuffix + "-" + safeName);
  },
});

export const uploadProcessedDoc = multer({
  storage: processedStorage,
  limits: { fileSize: 50 * 1024 * 1024 }, 
});