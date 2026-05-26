import { prisma } from "../../lib/prisma.js";

export const createTaskService = async (taskData: any, createdAt: string | undefined) => {
  const newTaskId = `task-${Date.now()}`;
  return prisma.task.create({
    data: {
      ...taskData,
      id: newTaskId,
      columnId: "col-1", 
      createdAt: createdAt ? new Date(createdAt) : new Date(),
    },
  });
};

export const updateTaskService = async (id: string, updateData: any) => {
  return prisma.task.update({
    where: { id },
    data: updateData,
  });
};

export const deleteTaskService = async (id: string) => {
  return prisma.task.delete({
    where: { id },
  });
};

export const moveTaskService = async (id: string, columnId: string) => {
  const oldTask = await prisma.task.findUnique({ where: { id } });
  if (!oldTask) throw new Error("Không tìm thấy thẻ khách hàng");
  
  const updatedTask = await prisma.task.update({
    where: { id },
    data: { columnId }, 
  });

  if (columnId === "col-4" && oldTask.columnId !== "col-4" && oldTask.assignedTo && !oldTask.commissionPaid) {
    const employee = await prisma.employee.findFirst({
      where: { name: oldTask.assignedTo }
    });

    if (employee) {
      await prisma.task.update({
        where: { id },
        data: { commissionPaid: true }
      });
    }
  }

  return updatedTask;
};

export const moveProcessingTaskService = async (id: string, processingColId: string) => {
  return prisma.task.update({
    where: { id },
    data: { processingColId },
  });
};

export const sendNotificationService = async (saleName: string, sender: string, customMessage: string, taskId: string) => {
  return prisma.notification.create({
    data: {
      sender: sender,
      message: customMessage,
      receiver: [saleName], 
      taskId: taskId
    }
  });
};
