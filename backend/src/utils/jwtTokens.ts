import jwt from "jsonwebtoken";
import type { Request } from "express";
import { JWT_REFRESH_SECRET } from "../../config/env.js";

/** Khớp `expiresIn` khi sign — refresh token có hiệu lực 7 ngày. */
export const REFRESH_TOKEN_EXPIRES = "7d" as const;

/** Cookie HttpOnly chứa JWT refresh (cùng thời hạn với token). */
export const REFRESH_COOKIE_NAME = "flyvisa_rt";
export const REFRESH_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const REFRESH_PAYLOAD_TYP = "refresh" as const;

export function signRefreshToken(employeeId: string): string {
  return jwt.sign(
    { sub: employeeId, typ: REFRESH_PAYLOAD_TYP },
    JWT_REFRESH_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRES },
  );
}

export function verifyRefreshToken(token: string): { sub: string } | null {
  try {
    const decoded = jwt.verify(token, JWT_REFRESH_SECRET) as jwt.JwtPayload;
    if (decoded.typ !== REFRESH_PAYLOAD_TYP || typeof decoded.sub !== "string" || !decoded.sub) {
      return null;
    }
    return { sub: decoded.sub };
  } catch {
    return null;
  }
}

/** Đọc cookie từ header (không cần cookie-parser). */
export function getCookieFromRequest(req: Request, name: string): string | undefined {
  const raw = req.headers.cookie;
  if (!raw) return undefined;
  for (const segment of raw.split(";")) {
    const idx = segment.indexOf("=");
    if (idx === -1) continue;
    const k = segment.slice(0, idx).trim();
    if (k !== name) continue;
    return decodeURIComponent(segment.slice(idx + 1).trim());
  }
  return undefined;
}
