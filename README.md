# Hệ thống quản lý Fly Visa

## Triển khai Railway và upload file

- **Backend HTTP:** `server.requestTimeout = 0` trong [`backend/src/server.ts`](backend/src/server.ts) để upload lớn/chậm không bị Node cắt sớm (mặc định ở một số phiên bản là ~5 phút). `headersTimeout` được tăng để tránh ngắt giữa chừng khi client gửi header chậm.
- **Kích thước file:** API hồ sơ đã xử lý dùng multer với giới hạn **`PROCESSED_DOC_MAX_FILE_BYTES`** trong [`backend/src/middlewares/upload.ts`](backend/src/middlewares/upload.ts) (hiện 500MB). Lỗi vượt quá sẽ trả **413** và mã **`LIMIT_FILE_SIZE`** trong JSON.
- **Lỗi "Request aborted":** Thường do client đóng tab, proxy hoặc nền tảng cắt kết nối. Backend trả **`UPLOAD_CLIENT_DISCONNECT`** (HTTP 499) khi nhận diện được; trên Railway vẫn nên đảm bảo **VITE_API_URL** trỏ đúng URL HTTPS API và tránh timeout phía edge nếu file rất lớn.
- **Frontend:** Upload dùng [`front-end/src/services/processedDocUpload.ts`](front-end/src/services/processedDocUpload.ts) có **credentials: include**, kiểm tra `response.ok`, đọc `error`/`code` từ JSON, và **retry** có giới hạn cho lỗi mạng tạm thời hoặc 502/503/504/429.
