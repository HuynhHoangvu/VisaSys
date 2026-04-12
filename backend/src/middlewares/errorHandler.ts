import { Request, Response, NextFunction } from "express";

export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = "AppError";
  }
}

/**
 * Global error handler — must be registered after all routes in app.ts.
 * Handles known error types (AppError, Prisma) and falls back to 500.
 */
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  console.error(`[${new Date().toISOString()}] ${req.method} ${req.path} →`, err.message);

  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  if (err.message?.includes("Record to update not found") || err.message?.includes("Record to delete not found")) {
    res.status(404).json({ error: "Không tìm thấy bản ghi" });
    return;
  }

  // Prisma unique constraint violation
  if ((err as any).code === "P2002") {
    res.status(400).json({ error: "Dữ liệu đã tồn tại trong hệ thống" });
    return;
  }

  res.status(500).json({ error: "Lỗi hệ thống, vui lòng thử lại sau" });
};
