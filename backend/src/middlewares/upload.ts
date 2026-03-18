import multer from "multer";
import { Storage } from "@google-cloud/storage";
import { Readable } from "stream";
import path from "path";
import fs from "fs";

// ==========================================
// GOOGLE CLOUD STORAGE CONFIG
// ==========================================
let storage: Storage;

// Đường dẫn file key trong container (do Docker mount vào khi chạy Local)
const keyFilename = path.join(process.cwd(), "config", "google-key.json");

if (fs.existsSync(keyFilename)) {
  // Ưu tiên 1: Chạy Local với file cứng (Bất khả chiến bại trên Docker)
  storage = new Storage({ 
    keyFilename,
    projectId: process.env.GCS_PROJECT_ID 
  });
  console.log("✅ GCS: Kết nối thành công bằng file google-key.json");
} else if (process.env.GCS_PRIVATE_KEY) {
  // Ưu tiên 2: Chạy Railway/Production bằng biến môi trường lẻ
  storage = new Storage({
    projectId: process.env.GCS_PROJECT_ID,
    credentials: {
      client_email: process.env.GCS_CLIENT_EMAIL,
      // Xử lý triệt để lỗi xuống dòng \n trên môi trường Linux/Docker
      private_key: process.env.GCS_PRIVATE_KEY.split(String.raw`\n`).join('\n'),
    },
  });
  console.log("✅ GCS: Kết nối thành công bằng Environment Variables");
} else {
  // Trường hợp dự phòng
  storage = new Storage();
  console.log("⚠️ GCS: Đang chạy ở chế độ mặc định (Chưa nhận được cấu hình)");
}

export const bucket = storage.bucket(process.env.GCS_BUCKET_NAME || "flyvisa-documents");

// ==========================================
// CẤU HÌNH MULTER (LƯU TẠM VÀO RAM)
// ==========================================
const memStorage = multer.memoryStorage();

// Cấu hình giới hạn 50MB
const multerUpload = multer({
  storage: memStorage,
  limits: { fileSize: 50 * 1024 * 1024 },
});

// Export cả 2 tên để fix lỗi SyntaxError ở các file Routes
export const uploadDoc = multerUpload;
export const uploadProcessedDoc = multerUpload;

// ==========================================
// HÀM HELPER UPLOAD DÙNG CHUNG
// ==========================================
export const uploadToGCS = (
  buffer: Buffer,
  folder: string,
  filename: string
): Promise<{ url: string; publicId: string }> => {
  return new Promise((resolve, reject) => {
    // 1. Chuẩn hóa tên file: Xóa dấu tiếng Việt, thay khoảng trắng bằng gạch dưới
    const safeName = filename
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd').replace(/Đ/g, 'D')
      .replace(/\s+/g, "_")
      .replace(/[^a-zA-Z0-9._-]/g, "");
      
    const gcsPath = `${folder}/${Date.now()}-${safeName}`;
    const file = bucket.file(gcsPath);

    // 2. Tạo luồng ghi vào GCS
    const stream = file.createWriteStream({ 
      resumable: false,
      metadata: {
        cacheControl: 'public, max-age=31536000', // Tối ưu cache cho browser
      }
    });

    stream.on("error", (err) => {
      console.error("❌ GCS Stream Error:", err);
      reject(err);
    });

    stream.on("finish", () => {
      // Encode URI để đảm bảo link không bị gãy nếu có ký tự lạ
      const publicUrl = `https://storage.googleapis.com/${bucket.name}/${encodeURIComponent(file.name)}`;
      resolve({ url: publicUrl, publicId: file.name });
    });

    // 3. Đẩy dữ liệu từ RAM lên Cloud
    Readable.from(buffer).pipe(stream);
  });
};