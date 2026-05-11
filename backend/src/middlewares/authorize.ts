import { Request, Response, NextFunction } from "express";

/** Rejects requests that have no active session. */
export const requireAuth = (req: Request, res: Response, next: NextFunction): void => {
  const user = (req.session as any).user;
  if (!user) {
    res.status(401).json({ error: "Chưa đăng nhập" });
    return;
  }
  next();
};

/**
 * Restricts a route to specific roles.
 * @example router.delete("/:id", requireAuth, requireRole(["Admin", "Giám đốc"]), deleteEmployee)
 */
export const requireRole = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req.session as any).user;
    if (!user) {
      res.status(401).json({ error: "Chưa đăng nhập" });
      return;
    }
    if (!roles.includes(user.role)) {
      res.status(403).json({ error: "Bạn không có quyền thực hiện thao tác này" });
      return;
    }
    next();
  };
};

/** Requires the logged-in user to have at least one of `keys` (mode `any`) or all of them (mode `all`). */
export const requirePermission = (keys: string[], mode: "any" | "all" = "any") => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req.session as any).user;
    if (!user) {
      res.status(401).json({ error: "Chưa đăng nhập" });
      return;
    }
    const perms: string[] = Array.isArray(user.permissions) ? user.permissions : [];
    const ok =
      mode === "all"
        ? keys.length > 0 && keys.every((k) => perms.includes(k))
        : keys.some((k) => perms.includes(k));
    if (!ok) {
      res.status(403).json({ error: "Bạn không có quyền thực hiện thao tác này" });
      return;
    }
    next();
  };
};

const HR_REGISTRY_WRITE = "hr.registry.write";
const HR_ATTENDANCE_SELF = "hr.attendance.self";

/**
 * Cho phép `hr.registry.write` HOẶC `hr.attendance.self` khi và chỉ khi `:id` trùng nhân viên đang đăng nhập
 * (chấm công / checkout / tạo đơn nghỉ cho chính mình).
 */
export const requireHrWriteOrSelfAttendance = (req: Request, res: Response, next: NextFunction): void => {
  const user = (req.session as any).user;
  if (!user) {
    res.status(401).json({ error: "Chưa đăng nhập" });
    return;
  }
  const perms: string[] = Array.isArray(user.permissions) ? user.permissions : [];
  if (perms.includes(HR_REGISTRY_WRITE)) {
    next();
    return;
  }
  const targetId = String(req.params.id || "").trim();
  const selfId = String(user.id || "").trim();
  if (perms.includes(HR_ATTENDANCE_SELF) && targetId && selfId && targetId === selfId) {
    next();
    return;
  }
  res.status(403).json({ error: "Bạn không có quyền thực hiện thao tác này" });
};
