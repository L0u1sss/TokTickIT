import type { PrismaClient } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { SESSION_COOKIE, tokenHash } from "../src/auth-service.js";

/** Inserts a real session for an owned test fixture; HTTP login has its own API suite. */
export async function cookieForUser(db: PrismaClient, userId: number) {
  const token = randomBytes(32).toString("base64url");
  await db.session.create({ data: { userId, tokenHash: tokenHash(token), expiresAt: new Date(Date.now() + 60000) } });
  return `${SESSION_COOKIE}=${token}`;
}
