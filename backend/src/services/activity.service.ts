import { prisma } from "../../lib/prisma.js";

export const createActivityService = async (data: any) => {
  return prisma.activity.create({
    data: {
      id: `act-${Date.now()}`,
      taskId: data.taskId,
      type: data.type,
      summary: data.summary,
      assignee: data.assignee,
      status: data.status,
      completed: data.completed || false,
      dueText: data.dueText,
      fileName: data.fileName,
      fileUrl: data.fileUrl,
      createdAt: new Date().toISOString(),
    },
  });
};

export const updateActivityService = async (id: string, completed: boolean) => {
  return prisma.activity.update({
    where: { id },
    data: { completed },
  });
};

export const deleteActivityService = async (id: string) => {
  return prisma.activity.delete({ where: { id } });
};
