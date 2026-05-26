import fsPromises from "fs/promises";
import path from "path";
import { prisma } from "../../lib/prisma.js";
import { bucket, uploadToGCS } from "../middlewares/upload.js";

const logUpload = (msg: string, meta?: Record<string, unknown>) => {
  const suffix = meta ? ` ${JSON.stringify(meta)}` : "";
  console.log(`[processed-docs:upload][${new Date().toISOString()}] ${msg}${suffix}`);
};

export const safeUnlink = async (filePath: string | undefined) => {
  if (!filePath) return;
  try {
    await fsPromises.unlink(filePath);
  } catch {
    // already gone or unreadable
  }
};

const deleteLocalFile = async (fileUrl: string) => {
  if (!fileUrl.startsWith("/uploads")) return;
  try {
    await fsPromises.unlink(path.join(process.cwd(), fileUrl));
  } catch {
    // File does not exist — ignore.
  }
};

export const getFoldersService = async () => {
  return prisma.processedFolder.findMany({ orderBy: { createdAt: "desc" } });
};

export const createFolderService = async (name: string, parentId?: string | null) => {
  return prisma.processedFolder.create({ data: { name, parentId } });
};

export const moveFolderService = async (id: string, parentId: string | null) => {
  if (id === parentId) throw new Error("Không thể di chuyển vào chính nó");
  return prisma.processedFolder.update({ where: { id }, data: { parentId } });
};

export const deleteFolderService = async (id: string) => {
  const files = await prisma.processedFile.findMany({ where: { folderId: id } });
  
  for (const file of files) {
    if (file.cloudinaryPublicId) {
      await bucket.file(file.cloudinaryPublicId).delete().catch(() => console.log("Không tìm thấy trên GCS"));
    } else if (file.fileUrl) {
      await deleteLocalFile(file.fileUrl);
    }
  }

  await prisma.processedFile.deleteMany({ where: { folderId: id } });
  await prisma.processedFolder.delete({ where: { id } });
};

export const renameFolderService = async (id: string, name: string) => {
  if (!name) throw new Error("Tên thư mục không được để trống");
  return prisma.processedFolder.update({ where: { id }, data: { name } });
};

export const getFilesService = async () => {
  return prisma.processedFile.findMany({ orderBy: { createdAt: "desc" } });
};

export const uploadFileService = async (fileParams: {
  path: string;
  originalname: string;
  sizeBytes: number;
  uploadedBy: string;
  sizeStr: string;
  folderId: string | null;
}) => {
  const decodedName = Buffer.from(fileParams.originalname, "latin1").toString("utf8").trim();
  if (!decodedName) {
    throw new Error("Tên file không hợp lệ");
  }

  logUpload("start", {
    name: decodedName,
    sizeBytes: fileParams.sizeBytes,
    folderId: fileParams.folderId,
    tempPath: fileParams.path,
  });

  let gcsObjectName: string | null = null;
  try {
    const result = await uploadToGCS(fileParams.path, "flyvisa-processed-docs", decodedName);
    gcsObjectName = result.publicId;

    const newFile = await prisma.processedFile.create({
      data: {
        name: decodedName,
        size: fileParams.sizeStr,
        uploadedBy: fileParams.uploadedBy,
        fileUrl: result.url,
        folderId: fileParams.folderId,
        cloudinaryPublicId: result.publicId,
      },
    });

    logUpload("success", { id: newFile.id, publicId: result.publicId });
    return newFile;
  } catch (error) {
    if (gcsObjectName) {
      await bucket.file(gcsObjectName).delete().catch(() => {
        logUpload("gcs_delete_after_failed_db_failed", { publicId: gcsObjectName });
      });
    }
    throw error;
  }
};

export const deleteFileService = async (id: string) => {
  const file = await prisma.processedFile.findUnique({ where: { id } });
  
  if (file) {
    if (file.cloudinaryPublicId) {
      await bucket.file(file.cloudinaryPublicId).delete().catch(() => console.log("Không thể xóa GCS file"));
    } else if (file.fileUrl) {
      await deleteLocalFile(file.fileUrl);
    }
  }

  await prisma.processedFile.delete({ where: { id } });
};

export const renameFileService = async (id: string, name: string) => {
  if (!name) throw new Error("Tên file không được để trống");
  return prisma.processedFile.update({ where: { id }, data: { name } });
};

export const moveFileService = async (id: string, folderId: string | null) => {
  return prisma.processedFile.update({
    where: { id },
    data: { folderId: folderId === "null" ? null : folderId },
  });
};
