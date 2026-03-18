import multer from "multer";
import { Storage } from "@google-cloud/storage";
import { Readable } from "stream";
import path from "path";
import fs from "fs";

// ==========================================
// GOOGLE CLOUD STORAGE CONFIG
// ==========================================
let storage: Storage;

// Trỏ tới thư mục backend/config/google-key.json (dành cho máy dev local)
const keyFilename = path.join(process.cwd(), "config", "google-key.json");

if (fs.existsSync(keyFilename)) {
  // 1. CHẠY LOCAL: Dùng thẳng file JSON
  storage = new Storage({ keyFilename });
  console.log("✅ Đã kết nối Google Cloud bằng file google-key.json");
} else if (process.env.GCLOUD_CREDENTIALS_JSON) {
  // 2. CHẠY TRÊN RAILWAY: Dùng file JSON dán nguyên cục vào biến môi trường
  try {
    const credentials = JSON.parse(process.env.GCLOUD_CREDENTIALS_JSON);
    
    // Sửa lỗi JWT Signature do Railway đổi \n thành chuỗi thường
    if (credentials.private_key) {
      credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
    }
    
    storage = new Storage({ credentials });
    console.log("✅ Đã kết nối Google Cloud bằng biến GCLOUD_CREDENTIALS_JSON");
  } catch (error) {
    console.error("❌ Lỗi parse biến môi trường GCLOUD_CREDENTIALS_JSON", error);
    storage = new Storage(); // Fallback an toàn
  }
} else {
  // 3. FALLBACK cuối cùng (nếu cấu hình sai)
  storage = new Storage();
  console.log("⚠️ Cảnh báo: Google Cloud khởi tạo không có cấu hình rõ ràng.");
}

export const bucket = storage.bucket(process.env.GCS_BUCKET_NAME || "fly-visa-document");

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
      // Ép encodeURI để phòng trường hợp tên file có ký tự dị biệt
      const publicUrl = `https://storage.googleapis.com/${bucket.name}/${encodeURI(file.name)}`;
      resolve({ url: publicUrl, publicId: file.name });
    });

    // Bơm buffer vào luồng upload của Google Cloud
    Readable.from(buffer).pipe(stream);
  });
};