import multer from "multer";
import fs from "fs";
import fsPromises from "fs/promises";
import path from "path";
import os from "os";
import { logger } from "../../lib/logger.js";

// Stub bucket object — kept so existing service imports don't break
export const bucket = {
  file: (name: string) => ({
    delete: async () => {
      const localPath = path.join(process.cwd(), "uploads", name);
      await fsPromises.unlink(localPath).catch(() => {});
    },
  }),
  name: "local",
};

// ── Multer: save temp file to OS tmpdir ──────────────────────────────────────
const diskStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, os.tmpdir()),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});

/** Max size for processed-doc uploads (multer + API messaging must stay aligned). */
export const PROCESSED_DOC_MAX_FILE_BYTES = 500 * 1024 * 1024;

const multerUpload = multer({
  storage: diskStorage,
  limits: { fileSize: PROCESSED_DOC_MAX_FILE_BYTES },
});

export const uploadDoc = multerUpload;
export const uploadProcessedDoc = multerUpload;

// ── Local storage helper (replaces GCS) ─────────────────────────────────────
// Moves temp file → uploads/{folder}/{timestamp}-{safeName}
// Returns a relative URL served by Express static middleware
export const uploadToGCS = async (
  filePath: string,
  folder: string,
  filename: string,
): Promise<{ url: string; publicId: string }> => {
  const safeName = filename
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d").replace(/Đ/g, "D")
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9._-]/g, "");

  const destName = `${Date.now()}-${safeName}`;
  const uploadDir = path.join(process.cwd(), "uploads", folder);
  await fsPromises.mkdir(uploadDir, { recursive: true });

  const destPath = path.join(uploadDir, destName);
  await fsPromises.copyFile(filePath, destPath);
  fs.unlink(filePath, () => {});

  const publicId = `${folder}/${destName}`;
  logger.info({ dest: destPath }, "[storage] file saved locally");
  return { url: `/uploads/${publicId}`, publicId };
};
