import multer from "multer";
import { Storage } from "@google-cloud/storage";
import { Readable } from "stream";
import path from "path";
import fs from "fs";

// ==========================================
// GOOGLE CLOUD STORAGE CONFIG
// ==========================================
let storage: Storage;

// Trỏ tới thư mục backend/config/google-key.json
const keyFilename = path.join(process.cwd(), "config", "google-key.json");

if (fs.existsSync(keyFilename)) {
  // 1. CHẠY LOCAL: Dùng thẳng file JSON (Tuyệt đối không bao giờ lỗi Key)
  storage = new Storage({ keyFilename });
  console.log("✅ Đã kết nối Google Cloud bằng file google-key.json");
} else {
  // 2. CHẠY TRÊN RAILWAY: Dùng biến môi trường (Railway xử lý xuống dòng rất tốt)
  storage = new Storage({
    projectId: process.env.GCS_PROJECT_ID,
    credentials: {
      client_email: process.env.GCS_CLIENT_EMAIL,
      private_key: process.env.GCS_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
  });
  console.log("✅ Đã kết nối Google Cloud bằng biến môi trường (Environment Variables)");
}

export const bucket = storage.bucket(process.env.GCS_BUCKET_NAME || "");

// ==========================================
// CẤU HÌNH MULTER (LƯU VÀO RAM TẠM THỜI)
// ==========================================
const memStorage = multer.memoryStorage();

export const uploadDoc = multer({
  storage: memStorage,
  limits: { fileSize: 50 * 1024 * 1024 }, // Giới hạn 50MB
});

export const uploadProcessedDoc = multer({
  storage: memStorage,
  limits: { fileSize: 50 * 1024 * 1024 },
});

// ==========================================
// HÀM HELPER UPLOAD CHUNG CHO TOÀN HỆ THỐNG
// ==========================================
export const uploadToGCS = (
  buffer: Buffer,
  folder: string,
  filename: string
): Promise<{ url: string; publicId: string }> => {
  return new Promise((resolve, reject) => {
    // Xóa dấu tiếng Việt và ký tự đặc biệt
    const safeName = filename
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd').replace(/Đ/g, 'D')
      .replace(/\s+/g, "_").replace(/[^a-zA-Z0-9._-]/g, "");
      
    const gcsPath = `${folder}/${Date.now()}-${safeName}`;
    const file = bucket.file(gcsPath);

    const stream = file.createWriteStream({
      resumable: false,
    });

    stream.on("error", (error) => {
      console.error("Lỗi Stream GCS:", error);
      reject(error);
    });
    
    stream.on("finish", () => {
      const publicUrl = `https://storage.googleapis.com/${bucket.name}/${file.name}`;
      // Trả về url public và "publicId" (chính là đường dẫn trên GCS để sau này xóa)
      resolve({ url: publicUrl, publicId: file.name });
    });

    // Bơm buffer vào luồng upload của Google Cloud
    Readable.from(buffer).pipe(stream);
  });
};