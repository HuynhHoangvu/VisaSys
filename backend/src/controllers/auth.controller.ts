// backend/src/controllers/auth.controller.ts
import { Request, Response } from "express";
import { prisma } from "../../lib/prisma.js";
import { buildSessionUserPayload } from "../services/accessResolution.js";
import { isProduction } from "../../config/env.js";
import {
  REFRESH_COOKIE_MAX_AGE_MS,
  REFRESH_COOKIE_NAME,
  getCookieFromRequest,
  signRefreshToken,
  verifyRefreshToken,
} from "../utils/jwtTokens.js";

/**
 * Authenticate an employee session.
 * Uses bcrypt to validate the submitted password against the saved hash.
 */
export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email và mật khẩu không được để trống!" });
    }

    const employee = await prisma.employee.findUnique({
      where: { email },
      include: { department: true },
    });

    if (!employee) {
      return res.status(401).json({ error: "Email không tồn tại!" });
    }

    if (password !== employee.password) {
      return res.status(401).json({ error: "Mật khẩu không chính xác!" });
    }

    const userData = await buildSessionUserPayload(employee.id);
    if (!userData) {
      return res.status(500).json({ error: "Lỗi tải tài khoản" });
    }

    (req.session as any).user = userData;

    const refreshJwt = signRefreshToken(employee.id);
    res.cookie(REFRESH_COOKIE_NAME, refreshJwt, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      maxAge: REFRESH_COOKIE_MAX_AGE_MS,
      path: "/",
    });

    res.json(userData);
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Lỗi server" });
  }
};

/**
 * Terminate the current user session and clear the session cookie.
 */
export const logout = async (req: Request, res: Response) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: "Không thể đăng xuất" });
    }
    res.clearCookie("connect.sid");
    res.clearCookie(REFRESH_COOKIE_NAME, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      path: "/",
    });
    res.json({ message: "Đăng xuất thành công" });
  });
};

/**
 * Gia hạn phiên đăng nhập nếu refresh JWT còn hạn (7 ngày kể từ lúc đăng nhập).
 */
export const refreshSession = async (req: Request, res: Response) => {
  const raw = getCookieFromRequest(req, REFRESH_COOKIE_NAME);
  if (!raw) {
    return res.status(401).json({ error: "Không có refresh token" });
  }
  const parsed = verifyRefreshToken(raw);
  if (!parsed) {
    return res.status(401).json({ error: "Refresh token không hợp lệ hoặc đã hết hạn" });
  }
  const userData = await buildSessionUserPayload(parsed.sub);
  if (!userData) {
    return res.status(401).json({ error: "Tài khoản không tồn tại" });
  }
  (req.session as any).user = userData;

  const nextRefresh = signRefreshToken(parsed.sub);
  res.cookie(REFRESH_COOKIE_NAME, nextRefresh, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    maxAge: REFRESH_COOKIE_MAX_AGE_MS,
    path: "/",
  });

  res.json(userData);
};

/**
 * Return the authenticated user's session profile.
 * If no session exists, respond with an unauthorized status.
 */
export const getCurrentUser = async (req: Request, res: Response) => {
  const user = (req.session as any).user;
  if (!user?.id) {
    return res.status(401).json({ error: "Chưa đăng nhập" });
  }
  const fresh = await buildSessionUserPayload(user.id);
  if (!fresh) {
    return res.status(401).json({ error: "Phiên không hợp lệ" });
  }
  (req.session as any).user = fresh;
  res.json(fresh);
};

/**
 * Change password — verify old password then update to new one.
 */
export const changePassword = async (req: Request, res: Response) => {
  try {
    const { employeeCode, oldPassword, newPassword } = req.body as {
      employeeCode: string;
      oldPassword: string;
      newPassword: string;
    };

    if (!employeeCode || !oldPassword || !newPassword) {
      return res.status(400).json({ error: "Thiếu thông tin bắt buộc" });
    }

    const employee = await prisma.employee.findUnique({
      where: { employeeCode },
    });

    if (!employee) {
      return res.status(404).json({ error: "Không tìm thấy nhân viên" });
    }

    if (employee.password !== oldPassword) {
      return res.status(400).json({ error: "Mật khẩu hiện tại không đúng" });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: "Mật khẩu mới phải có ít nhất 6 ký tự" });
    }

    await prisma.employee.update({
      where: { employeeCode },
      data: { password: newPassword },
    });

    res.json({ message: "Đổi mật khẩu thành công" });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({ error: "Lỗi server" });
  }
};
