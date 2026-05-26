import { prisma } from "../../lib/prisma.js";
import { buildSessionUserPayload } from "./accessResolution.js";
import { signRefreshToken, verifyRefreshToken } from "../utils/jwtTokens.js";

export const loginService = async (email?: string, password?: string) => {
  if (!email || !password) {
    throw new Error("Email và mật khẩu không được để trống!");
  }

  const employee = await prisma.employee.findUnique({
    where: { email },
    include: { department: true },
  });

  if (!employee) {
    throw new Error("Email không tồn tại!");
  }

  if (password !== employee.password) {
    throw new Error("Mật khẩu không chính xác!");
  }

  const userData = await buildSessionUserPayload(employee.id);
  if (!userData) {
    throw new Error("Lỗi tải tài khoản");
  }

  const refreshJwt = signRefreshToken(employee.id);

  return { userData, refreshJwt };
};

export const refreshSessionService = async (rawToken?: string) => {
  if (!rawToken) {
    throw new Error("Không có refresh token");
  }

  const parsed = verifyRefreshToken(rawToken);
  if (!parsed) {
    throw new Error("Refresh token không hợp lệ hoặc đã hết hạn");
  }

  const userData = await buildSessionUserPayload(parsed.sub);
  if (!userData) {
    throw new Error("Tài khoản không tồn tại");
  }

  const nextRefresh = signRefreshToken(parsed.sub);

  return { userData, nextRefresh };
};

export const getCurrentUserService = async (userId: string) => {
  const fresh = await buildSessionUserPayload(userId);
  if (!fresh) {
    throw new Error("Phiên không hợp lệ");
  }
  return fresh;
};

export const changePasswordService = async (employeeCode?: string, oldPassword?: string, newPassword?: string) => {
  if (!employeeCode || !oldPassword || !newPassword) {
    throw new Error("Thiếu thông tin bắt buộc");
  }

  const employee = await prisma.employee.findUnique({
    where: { employeeCode },
  });

  if (!employee) {
    throw new Error("Không tìm thấy nhân viên");
  }

  if (employee.password !== oldPassword) {
    throw new Error("Mật khẩu hiện tại không đúng");
  }

  if (newPassword.length < 6) {
    throw new Error("Mật khẩu mới phải có ít nhất 6 ký tự");
  }

  await prisma.employee.update({
    where: { employeeCode },
    data: { password: newPassword },
  });
};
