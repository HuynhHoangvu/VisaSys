import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { Readable } from "stream";
import type { Request } from "express";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Custom storage dùng Cloudinary v2
const createCloudinaryStorage = (folder: string) => ({
  _handleFile(req: Request, file: Express.Multer.File, cb: Function) {
    const decodedName = Buffer.from(file.originalname, "latin1").toString("utf8");
    const safeName = decodedName.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9._-]/g, "_");
    const publicId = `${folder}/${Date.now()}-${Math.round(Math.random() * 1e9)}-${safeName}`;

    const uploadStream = cloudinary.uploader.upload_stream(
      { resource_type: "raw", public_id: publicId },
      (error, result) => {
        if (error) return cb(error);
        cb(null, {
          path: result!.secure_url,        // URL Cloudinary
          filename: result!.public_id,     // public_id để xóa sau
          size: result!.bytes,
        });
      }
    );

    const readable = new Readable();
    readable.push(file.buffer);  // cần memoryStorage để có buffer
    readable.push(null);
    readable.pipe(uploadStream);
  },
  _removeFile(req: Request, file: Express.Multer.File, cb: Function) {
    cb(null);
  },
});

// Dùng memoryStorage để lấy buffer trước khi upload lên Cloudinary
const memStorage = multer.memoryStorage();

// ==========================================
// 1. TÀI LIỆU CÔNG TY
// ==========================================
export const uploadDoc = multer({
  storage: memStorage,
  limits: { fileSize: 50 * 1024 * 1024 },
});

// ==========================================
// 2. HỒ SƠ ĐÃ XỬ LÝ
// ==========================================
export const uploadProcessedDoc = multer({
  storage: memStorage,
  limits: { fileSize: 50 * 1024 * 1024 },
});

// Export cloudinary upload helper để dùng trong controller
export const uploadToCloudinary = (
  buffer: Buffer,
  folder: string,
  filename: string
): Promise<{ url: string; publicId: string }> => {
  return new Promise((resolve, reject) => {
    const safeName = filename.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9._-]/g, "_");
    const publicId = `fly-visa/${folder}/${Date.now()}-${safeName}`;

    const stream = cloudinary.uploader.upload_stream(
      { resource_type: "raw", public_id: publicId },
      (error, result) => {
        if (error) return reject(error);
        resolve({ url: result!.secure_url, publicId: result!.public_id });
      }
    );

    const readable = new Readable();
    readable.push(buffer);
    readable.push(null);
    readable.pipe(stream);
  });
};