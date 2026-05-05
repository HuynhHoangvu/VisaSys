import { Request, Response, NextFunction } from "express";
import { PROCESSED_DOC_MAX_FILE_BYTES } from "./upload.js";

function isMulterError(err: unknown): err is Error & { code: string; field?: string } {
  return err instanceof Error && err.name === "MulterError" && "code" in err;
}

function isClientDisconnect(err: Error): boolean {
  const msg = (err.message || "").toLowerCase();
  if (msg.includes("request aborted") || msg.includes("aborted")) return true;
  const anyErr = err as NodeJS.ErrnoException;
  if (anyErr.code === "ECONNRESET" || anyErr.code === "EPIPE" || anyErr.code === "ETIMEDOUT")
    return true;
  return false;
}

const maxMb = Math.floor(PROCESSED_DOC_MAX_FILE_BYTES / (1024 * 1024));

const multerCodeMessagesVi: Record<string, { status: number; error: string; code: string }> = {
  LIMIT_FILE_COUNT: {
    status: 400,
    error: "Quá nhiều file trong một lần gửi.",
    code: "LIMIT_FILE_COUNT",
  },
  LIMIT_FIELD_KEY: {
    status: 400,
    error: "Tên trường form quá dài.",
    code: "LIMIT_FIELD_KEY",
  },
  LIMIT_FIELD_VALUE: {
    status: 400,
    error: "Giá trị trường form quá dài.",
    code: "LIMIT_FIELD_VALUE",
  },
  LIMIT_FIELD_COUNT: {
    status: 400,
    error: "Quá nhiều trường form.",
    code: "LIMIT_FIELD_COUNT",
  },
  LIMIT_PART_COUNT: {
    status: 400,
    error: "Multipart quá phức tạp (quá nhiều phần).",
    code: "LIMIT_PART_COUNT",
  },
  LIMIT_UNEXPECTED_FILE: {
    status: 400,
    error: "Trường file không đúng (mong đợi field \"file\").",
    code: "LIMIT_UNEXPECTED_FILE",
  },
  MISSING_FIELD_NAME: {
    status: 400,
    error: "Thiếu tên trường trong form.",
    code: "MISSING_FIELD_NAME",
  },
};

export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 500,
    public code?: string,
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

  if (res.headersSent) {
    return;
  }

  if (err instanceof AppError) {
    const body: { error: string; code?: string } = { error: err.message };
    if (err.code) body.code = err.code;
    res.status(err.statusCode).json(body);
    return;
  }

  if (isMulterError(err)) {
    if (err.code === "LIMIT_FILE_SIZE") {
      res.status(413).json({
        error: `File vượt quá giới hạn kích thước (tối đa ${maxMb}MB).`,
        code: "LIMIT_FILE_SIZE",
      });
      return;
    }
    const mapped = multerCodeMessagesVi[err.code];
    if (mapped) {
      res.status(mapped.status).json({ error: mapped.error, code: mapped.code });
      return;
    }
    res.status(400).json({
      error: err.message || "Lỗi tải file (multipart)",
      code: err.code,
    });
    return;
  }

  if (isClientDisconnect(err)) {
    res.status(499).json({
      error: "Kết nối upload bị ngắt (client hoặc proxy). Thử lại với file nhỏ hơn hoặc kiểm tra mạng.",
      code: "UPLOAD_CLIENT_DISCONNECT",
    });
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
