import multer from "multer";
import { Storage } from "@google-cloud/storage";
import { Readable } from "stream";
import path from "path";
import fs from "fs";
import os from "os";

// ==========================================
// GOOGLE CLOUD STORAGE CONFIG
// ==========================================
let storage: Storage;
let bucketName = process.env.GCS_BUCKET_NAME || "fly-visa-document";

// Kiểm tra xem file cấu hình cứng (chạy ở máy tính cá nhân) có tồn tại không
const localKeyFilename = path.join(process.cwd(), "config", "google-key.json");

if (fs.existsSync(localKeyFilename)) {
  console.log("✅ Đã kết nối Google Cloud bằng file cứng ở local");
  storage = new Storage({ keyFilename: localKeyFilename });
} 
// Nếu không có file cứng -> đang chạy trên Railway
else if (process.env.GCLOUD_CREDENTIALS_JSON) {
  try {
    // 1. Tạo một đường dẫn file tạm trong hệ thống server Railway (vd: /tmp/gcs-key.json)
    const tempKeyPath = path.join(os.tmpdir(), 'gcs-key.json');
    
    // 2. Đọc biến môi trường và ghi đè vào file tạm đó. 
    // Làm cách này để đảm bảo format JSON và các dấu \n được giữ nguyên 100% chuẩn xác.
    fs.writeFileSync(tempKeyPath, process.env.GCLOUD_CREDENTIALS_JSON, 'utf8');
    
    // 3. Báo cho Google Cloud đọc từ cái file tạm này
    storage = new Storage({ keyFilename: tempKeyPath });
    
    console.log("✅ Đã kết nối Google Cloud bằng biến môi trường (Thông qua file tạm)");
  } catch (error) {
    console.error("❌ Lỗi xử lý biến môi trường GCLOUD_CREDENTIALS_JSON:", error);
    storage = new Storage(); // Fallback an toàn
  }
} else {
  console.log("⚠️ Cảnh báo: Chưa cấu hình Google Cloud!");
  storage = new Storage();
}

export const bucket = storage.bucket(bucketName);

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
    // Xóa dấu tiếng Việt và ký tự đặc biệt để làm tên file lưu trên GCS
    const safeName = filename
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd').replace(/Đ/g, 'D')
      .replace(/\s+/g, "_").replace(/[^a-zA-Z0-9._-]/g, "");
      
    // Gộp tên folder và tên file lại
    const gcsPath = `${folder}/${Date.now()}-${safeName}`;
    const file = bucket.file(gcsPath);

    // Mở luồng ghi
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

    // Bơm file vào luồng
    Readable.from(buffer).pipe(stream);
  });
};