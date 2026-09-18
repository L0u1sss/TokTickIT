import type { Request, Response, NextFunction } from "express";
import type { UserRole } from "@prisma/client";
import { ApiError } from "./errors.js";
import { randomBytes, timingSafeEqual } from "node:crypto";

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

function readCookie(req: Request, name: string): string | undefined {
  return req.headers.cookie?.split(";").map(value => value.trim()).find(value => value.startsWith(`${name}=`))?.slice(name.length + 1);
}

export function requireStaffCsrf(req: Request, res: Response, next: NextFunction) {
  const cookieName = "toktickit_csrf";
  let token = readCookie(req, cookieName);
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) {
    token = randomBytes(32).toString("base64url");
    res.cookie(cookieName, token, { httpOnly: false, sameSite: "lax", path: "/", secure: process.env.NODE_ENV !== "development" && process.env.NODE_ENV !== "test" });
  }
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    next();
    return;
  }
  const submitted = req.get("X-CSRF-Token");
  const submittedBytes = submitted ? Buffer.from(submitted) : null;
  const tokenBytes = Buffer.from(token);
  if (!submittedBytes || submittedBytes.length !== tokenBytes.length || !timingSafeEqual(submittedBytes, tokenBytes)) {
    next(new ApiError(403, "CSRF_TOKEN_INVALID", "The request could not be verified."));
    return;
  }
  next();
}
