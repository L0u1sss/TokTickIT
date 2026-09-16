import type { Request, Response, NextFunction } from "express";
import type { UserRole } from "@prisma/client";
import { ApiError } from "./errors.js";

export function requireRole(...roles: UserRole[]) {
  return (_req: Request, res: Response, next: NextFunction) => {
    if (!roles.includes(res.locals.authenticatedUser.role)) {
      next(new ApiError(403, "FORBIDDEN", "You do not have permission to perform this operation."));
      return;
    }
    next();
  };
}

export function requireApprovedOrigin(req: Request, _res: Response, next: NextFunction) {
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method) && req.get("Origin") !== (process.env.CLIENT_ORIGIN ?? "http://localhost:5173")) {
    next(new ApiError(403, "ORIGIN_NOT_ALLOWED", "The request origin is not allowed."));
    return;
  }
  next();
}
