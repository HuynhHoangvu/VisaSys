import fsPromises from "fs/promises";
import path from "path";
import { prisma } from "../../lib/prisma.js";
import { bucket, uploadToGCS } from "../middlewares/upload.js";

const deleteLocalFile = async (fileUrl: string) => {
  if (!fileUrl.startsWith("/uploads")) return;
  const filePath = path.join(process.cwd(), fileUrl);
  try {
    await fsPromises.unlink(filePath);
  } catch {
    // ignore
  }
};

export const getFoldersService = async () => {
  return prisma.docFolder.findMany({ orderBy: { createdAt: "desc" } });
};

export const createFolderService = async (name: string, parentId?: string | null) => {
  return prisma.docFolder.create({ data: { name, parentId } });
};

export const deleteFolderService = async (id: string) => {
  const files = await prisma.docFile.findMany({ where: { folderId: id } });
  
  for (const file of files) {
    if (file.cloudinaryPublicId) {
      await bucket.file(file.cloudinaryPublicId).delete().catch(() => console.log("GCS file not found"));
    } else if (file.fileUrl) {
      await deleteLocalFile(file.fileUrl);
    }
  }

  await prisma.docFile.deleteMany({ where: { folderId: id } });
  await prisma.docFolder.delete({ where: { id } });
};

export const moveFolderService = async (id: string, parentId: string | null) => {
  if (id === parentId) throw new Error("Cannot move folder into itself");
  return prisma.docFolder.update({ where: { id }, data: { parentId } });
};

export const renameFolderService = async (id: string, name: string) => {
  if (!name) throw new Error("Tên thư mục không được để trống");
  return prisma.docFolder.update({ where: { id }, data: { name } });
};

export const getFilesService = async () => {
  return prisma.docFile.findMany({ orderBy: { createdAt: "desc" } });
};

export const uploadFileService = async (fileParams: {
  path: string;
  originalname: string;
  uploadedBy: string;
  size: string;
  folderId: string | null;
}) => {
  const decodedName = Buffer.from(fileParams.originalname, "latin1").toString("utf8");
  
  const gcsResult = await uploadToGCS(fileParams.path, "documents", decodedName);

  return prisma.docFile.create({
    data: {
      name: decodedName, 
      size: fileParams.size,
      uploadedBy: fileParams.uploadedBy,
      fileUrl: gcsResult.url,
      cloudinaryPublicId: gcsResult.publicId,
      folderId: fileParams.folderId,
    },
  });
};

export const deleteFileService = async (id: string) => {
  const file = await prisma.docFile.findUnique({ where: { id } });
  
  if (file) {
    if (file.cloudinaryPublicId) {
      await bucket.file(file.cloudinaryPublicId).delete().catch(() => console.log("GCS file not found"));
    } else if (file.fileUrl) {
      await deleteLocalFile(file.fileUrl);
    }
  }

  await prisma.docFile.delete({ where: { id } });
};

export const renameFileService = async (id: string, name: string) => {
  if (!name) throw new Error("File name must not be empty");
  return prisma.docFile.update({ where: { id }, data: { name } });
};

export const moveFileService = async (id: string, folderId: string | null) => {
  return prisma.docFile.update({
    where: { id },
    data: { folderId: folderId === "null" ? null : folderId },
  });
};
