// backend/src/controllers/auth.controller.ts
import { Request, Response } from "express";
import { sessionCookieCrossSite } from "../../config/env.js";
import {
  REFRESH_COOKIE_MAX_AGE_MS,
  REFRESH_COOKIE_NAME,
  getCookieFromRequest,
} from "../utils/jwtTokens.js";
import {
  loginService,
  refreshSessionService,
  getCurrentUserService,
  changePasswordService,
  requestForgotPasswordService,
} from "../services/auth.service.js";
import { getIO } from "../socket.js";


/**
 * Authenticate an employee session.
 */
export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    const { userData, refreshJwt } = await loginService(email, password);

    (req.session as any).user = userData;

    await new Promise<void>((resolve, reject) => {
      req.session.save((err) => {
        if (err) {
          console.error("[auth] login — session.save() failed:", err);
          reject(err);
        } else {
          console.log(
            `[auth] login — session saved | id=${req.sessionID} | user=${userData.id} (${userData.role})`,
          );
          resolve();
        }
      });
    });

    res.cookie(REFRESH_COOKIE_NAME, refreshJwt, {
      httpOnly: true,
      secure: sessionCookieCrossSite,
      sameSite: sessionCookieCrossSite ? "none" : "lax",
      maxAge: REFRESH_COOKIE_MAX_AGE_MS,
      path: "/",
    });

    res.json({
      ...userData,
      token: req.sessionID,
    });
  } catch (error: any) {
    if (["Email và mật khẩu không được để trống!", "Email không tồn tại!", "Mật khẩu không chính xác!"].includes(error.message)) {
        return res.status(400).json({ error: error.message });
    }
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
      secure: sessionCookieCrossSite,
      sameSite: sessionCookieCrossSite ? "none" : "lax",
      path: "/",
    });
    res.json({ message: "Đăng xuất thành công" });
  });
};

/**
 * Gia hạn phiên đăng nhập nếu refresh JWT còn hạn.
 */
export const refreshSession = async (req: Request, res: Response) => {
  try {
    const raw = getCookieFromRequest(req, REFRESH_COOKIE_NAME);
    const { userData, nextRefresh } = await refreshSessionService(raw);

    (req.session as any).user = userData;

    await new Promise<void>((resolve, reject) => {
      req.session.save((err) => {
        if (err) {
          console.error("[auth] refreshSession — session.save() failed:", err);
          reject(err);
        } else {
          console.log(
            `[auth] refreshSession — session saved | id=${req.sessionID} | user=${userData.id} (${userData.role})`,
          );
          resolve();
        }
      });
    });

    res.cookie(REFRESH_COOKIE_NAME, nextRefresh, {
      httpOnly: true,
      secure: sessionCookieCrossSite,
      sameSite: sessionCookieCrossSite ? "none" : "lax",
      maxAge: REFRESH_COOKIE_MAX_AGE_MS,
      path: "/",
    });

    res.json({
      ...userData,
      token: req.sessionID,
    });
  } catch (error: any) {
    res.status(401).json({ error: error.message });
  }
};

/**
 * Return the authenticated user's session profile.
 */
export const getCurrentUser = async (req: Request, res: Response) => {
  try {
    const user = (req.session as any).user;
    if (!user?.id) {
      return res.status(401).json({ error: "Chưa đăng nhập" });
    }

    const fresh = await getCurrentUserService(user.id);

    (req.session as any).user = fresh;
    res.json({
      ...fresh,
      token: req.sessionID,
    });
  } catch (error: any) {
    res.status(401).json({ error: error.message });
  }
};

/**
 * Change password
 */
export const changePassword = async (req: Request, res: Response) => {
  try {
    const { employeeCode, oldPassword, newPassword } = req.body;
    await changePasswordService(employeeCode, oldPassword, newPassword);
    res.json({ message: "Đổi mật khẩu thành công" });
  } catch (error: any) {
    if (["Thiếu thông tin bắt buộc", "Không tìm thấy nhân viên", "Mật khẩu hiện tại không đúng", "Mật khẩu mới phải có ít nhất 6 ký tự"].includes(error.message)) {
        return res.status(400).json({ error: error.message });
    }
    console.error("Change password error:", error);
    res.status(500).json({ error: "Lỗi server" });
  }
};

export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    const { message, receivers } = await requestForgotPasswordService(email);

    // Gửi thông báo socket real-time cho các Admin đang online
    getIO().emit("new_notification", { message, receivers });

    res.json({ message: "Yêu cầu khôi phục mật khẩu đã được gửi đến Admin. Vui lòng liên hệ Admin để nhận mật khẩu mới!" });
  } catch (error: any) {
    if (["Vui lòng cung cấp email!", "Email không tồn tại trên hệ thống!"].includes(error.message)) {
      return res.status(400).json({ error: error.message });
    }
    console.error("Forgot password error:", error);
    res.status(500).json({ error: "Lỗi server" });
  }
};

