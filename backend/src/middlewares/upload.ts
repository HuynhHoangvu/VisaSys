import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { Readable } from "stream";
import type { Request } from "express";

// ❌ XÓA cloudinary.config() ở đây

// Helper để đảm bảo config luôn được gọi khi dùng
const getCloudinary = () => {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  return cloudinary;
};

// Dùng memoryStorage để lấy buffer trước khi upload lên Cloudinary
const memStorage = multer.memoryStorage();

export const uploadDoc = multer({
  storage: memStorage,
  limits: { fileSize: 50 * 1024 * 1024 },
});

export const uploadProcessedDoc = multer({
  storage: memStorage,
  limits: { fileSize: 50 * 1024 * 1024 },
});

export const uploadToCloudinary = (
  buffer: Buffer,
  folder: string,
  filename: string
): Promise<{ url: string; publicId: string }> => {
  return new Promise((resolve, reject) => {
    const safeName = filename.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9._-]/g, "_");
    const publicId = `fly-visa/${folder}/${Date.now()}-${safeName}`;

    // ✅ Dùng getCloudinary() thay vì cloudinary trực tiếp
    const stream = getCloudinary().uploader.upload_stream(
      { resource_type: "raw", public_id: publicId },
      (error, result) => {
        if (error) return reject(error);
        resolve({ url: result!.secure_url, publicId: result!.public_id });
      }
    );

    Readable.from(buffer).pipe(stream); // ✅ gọn hơn
  });
};