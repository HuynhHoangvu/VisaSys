import { prisma } from "../../lib/prisma.js";

export const getNotificationsService = async (saleName: string) => {
  return prisma.notification.findMany({
    where: { 
      receiver:  { has: saleName }, 
      isRead: false 
    },
    orderBy: { createdAt: 'desc' }
  });
};

export const sendReminderService = async (customerName: string, saleName: string, sender: string, customMessage: string, taskId: string) => {
  const text = customMessage
      ? `Hồ sơ [${customerName}]: ${customMessage}`
      : `Hồ sơ khách hàng [${customerName}] đang cần xử lý gấp.`;

  return prisma.notification.create({
      data: {
          sender: sender || "Ban Giám Đốc",
          message: text,
          receiver: [saleName],
          taskId: taskId
      }
  });
};

export const sendExamSubmittedNotificationService = async (
  studentName: string,
  examName?: string,
  score?: string | number,
  submittedAt?: string,
  sender?: string
) => {
  const teacherUsers = await prisma.employee.findMany({
    where: {
      department: {
        name: { contains: "giáo viên", mode: "insensitive" },
      },
    },
    select: { name: true },
  });

  const receivers = [...new Set(teacherUsers.map((u) => u.name).filter(Boolean))];
  if (receivers.length === 0) {
    throw new Error("Không tìm thấy người nhận thuộc nhóm giáo viên");
  }

  const scoreText = score !== undefined && score !== null && `${score}`.trim() !== ""
    ? ` | Điểm: ${score}`
    : "";
  const examText = examName?.trim() ? `Bài: ${examName.trim()} | ` : "";
  const timeText = submittedAt?.trim()
    ? ` | Lúc: ${submittedAt.trim()}`
    : ` | Lúc: ${new Date().toLocaleString("vi-VN")}`;

  const safeStudentName = studentName.trim();
  const message = `${examText}Học viên ${safeStudentName} đã nộp bài${scoreText}${timeText}`;

  const newNotif = await prisma.notification.create({
    data: {
      sender: sender?.trim() || "Fly Test System",
      message,
      receiver: receivers,
    },
  });

  return { newNotif, receivers };
};

export const markAsReadService = async (id: string) => {
  return prisma.notification.update({
    where: { id },
    data: { isRead: true }
  });
};
