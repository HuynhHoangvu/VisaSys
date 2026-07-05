import { Request, Response } from "express";
import { prisma } from "../../lib/prisma.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";

// Tạo roomId DM cố định từ 2 userId (sort để đảm bảo đồng nhất)
function dmRoomName(a: string, b: string) {
  return [a, b].sort().join("__dm__");
}

// GET /api/chat/users — danh sách tất cả nhân viên để chat
export const getChatUsers = asyncHandler(async (req: Request, res: Response) => {
  const user = (req.session as any).user;

  const employees = await prisma.employee.findMany({
    where: { id: { not: user.id } },
    select: { id: true, name: true, role: true, departmentId: true,
      department: { select: { name: true } } },
    orderBy: { name: "asc" },
  });

  res.json(employees);
});

// GET /api/chat/conversations — lịch sử các cuộc trò chuyện của user
export const getConversations = asyncHandler(async (req: Request, res: Response) => {
  const user = (req.session as any).user;

  // Tìm tất cả DM room mà user này tham gia (name chứa userId)
  const rooms = await prisma.chatRoom.findMany({
    where: { type: "dm", name: { contains: user.id } },
  });

  if (rooms.length === 0) return res.json([]);

  // Lấy tin nhắn cuối + thông tin người còn lại
  const results = await Promise.all(
    rooms.map(async (room) => {
      const parts = room.name.split("__dm__");
      const otherId = parts.find((p) => p !== user.id) ?? "";

      const [other, lastMsg, unread] = await Promise.all([
        prisma.employee.findUnique({
          where: { id: otherId },
          select: { id: true, name: true, role: true, department: { select: { name: true } } },
        }),
        prisma.chatMessage.findFirst({
          where: { roomId: room.id },
          orderBy: { createdAt: "desc" },
        }),
        prisma.chatMessage.count({
          where: { roomId: room.id, senderId: { not: user.id } },
        }),
      ]);

      if (!other) return null;
      return { room, other, lastMsg, unread };
    })
  );

  const sorted = results
    .filter(Boolean)
    .sort((a, b) => {
      const ta = a!.lastMsg?.createdAt?.getTime() ?? 0;
      const tb = b!.lastMsg?.createdAt?.getTime() ?? 0;
      return tb - ta;
    });

  res.json(sorted);
});

// GET /api/chat/dm/:targetId — lấy hoặc tạo phòng DM với targetId
export const getDmRoom = asyncHandler(async (req: Request, res: Response) => {
  const user = (req.session as any).user;
  const targetId = req.params.targetId as string;

  if (targetId === user.id) {
    return res.status(400).json({ error: "Không thể tự nhắn cho bản thân." });
  }

  const target = await prisma.employee.findUnique({
    where: { id: targetId },
    select: { id: true, name: true, role: true },
  });
  if (!target) return res.status(404).json({ error: "Người dùng không tồn tại." });

  const roomName = dmRoomName(user.id, targetId);

  let room = await prisma.chatRoom.findFirst({ where: { name: roomName, type: "dm" } });

  if (!room) {
    room = await prisma.chatRoom.create({
      data: { name: roomName, type: "dm" },
    });
  }

  res.json({ room, target });
});

// GET /api/chat/rooms/:roomId/messages — lịch sử tin nhắn
export const getMessages = asyncHandler(async (req: Request, res: Response) => {
  const roomId = req.params.roomId as string;
  const user = (req.session as any).user;

  const room = await prisma.chatRoom.findUnique({ where: { id: roomId } });
  if (!room) return res.status(404).json({ error: "Phòng không tồn tại." });

  // Với DM room: tên chứa userId của cả 2 bên
  if (room.type === "dm" && !room.name.includes(user.id)) {
    return res.status(403).json({ error: "Bạn không có quyền xem." });
  }

  const messages = await prisma.chatMessage.findMany({
    where: { roomId },
    orderBy: { createdAt: "asc" },
    take: 50,
  });

  res.json(messages);
});
