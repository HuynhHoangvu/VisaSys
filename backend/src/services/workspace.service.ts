import { prisma } from "../../lib/prisma.js";

export const getWorkspacesService = async () => {
  return prisma.workspace.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, url: true },
  });
};

export const createWorkspaceService = async (name: string, url: string | undefined, employeeId: string) => {
  return prisma.workspace.create({
    data: { name: name.trim(), url: url?.trim() || null, employeeId },
    select: { id: true, name: true, url: true },
  });
};

export const updateWorkspaceService = async (id: string, name: string, url: string | undefined, employeeId: string) => {
  if (employeeId) {
    const existing = await prisma.workspace.findFirst({ where: { id, employeeId } });
    if (!existing) throw new Error("Không tìm thấy workspace");
  }
  return prisma.workspace.update({
    where: { id },
    data: { name: name.trim(), url: url?.trim() || null },
    select: { id: true, name: true, url: true },
  });
};

export const deleteWorkspaceService = async (id: string, employeeId: string) => {
  const countWhere = employeeId ? { employeeId } : { id };
  const count = await prisma.workspace.count({ where: countWhere });
  if (count <= 1) {
    throw new Error("Phải có ít nhất 1 workspace");
  }

  return prisma.workspace.delete({ where: { id } });
};
