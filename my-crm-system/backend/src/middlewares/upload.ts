import multer from "multer";
import fs from "fs";
import path from "path";

// Tạo thư mục "uploads/documents" nếu nó chưa tồn tại
const dir = path.join(process.cwd(), "uploads", "documents");
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    // 1. DỊCH LẠI FONT TIẾNG VIỆT TỪ LATIN1 SANG UTF-8
    const decodedName = Buffer.from(file.originalname, "latin1").toString("utf8");
    
    // 2. TẠO TÊN AN TOÀN (Thêm timestamp + xóa khoảng trắng)
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const safeName = decodedName.replace(/\s+/g, "_");
    
    cb(null, uniqueSuffix + "-" + safeName);
  },
});

// Giới hạn file 50MB
export const uploadDoc = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 }, 
});