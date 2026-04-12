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
