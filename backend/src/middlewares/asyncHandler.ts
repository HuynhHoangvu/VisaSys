import { Request, Response, NextFunction, RequestHandler } from "express";

/**
 * Wraps an async route handler to forward any unhandled rejection to the
 * global error handler instead of leaving the request hanging.
 */
export const asyncHandler = (fn: RequestHandler): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
