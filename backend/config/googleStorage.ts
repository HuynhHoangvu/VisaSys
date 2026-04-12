import { Storage } from "@google-cloud/storage";
import fs from "fs";
import {
  GCS_BUCKET_NAME,
  GCS_PROJECT_ID,
  GCS_CLIENT_EMAIL,
  GCS_PRIVATE_KEY,
  GOOGLE_KEYFILE_PATH,
} from "./env.js";

let storage: Storage;

if (fs.existsSync(GOOGLE_KEYFILE_PATH)) {
  storage = new Storage({
    keyFilename: GOOGLE_KEYFILE_PATH,
    projectId: GCS_PROJECT_ID,
  });
  console.log("✅ GCS: Kết nối thành công bằng file google-key.json");
} else if (GCS_PRIVATE_KEY && GCS_CLIENT_EMAIL) {
  storage = new Storage({
    projectId: GCS_PROJECT_ID,
    credentials: {
      client_email: GCS_CLIENT_EMAIL,
      private_key: GCS_PRIVATE_KEY.split(String.raw`\n`).join("\n"),
    },
  });
  console.log("✅ GCS: Kết nối thành công bằng Environment Variables");
} else {
  storage = new Storage();
  console.warn("⚠️ GCS: Chưa nhận được cấu hình đầy đủ, đang dùng client mặc định.");
}

export const bucketName = GCS_BUCKET_NAME;
export const gcsStorage = storage;
export const gcsBucket = storage.bucket(GCS_BUCKET_NAME);
