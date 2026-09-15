import argon2 from "argon2";
import { randomBytes } from "node:crypto";
import { validationError } from "./errors.js";

export const PASSWORD_RULES = "Use 12–128 characters, no leading/trailing whitespace, and at least three of lowercase, uppercase, numbers and symbols.";

export function validateNewPassword(password: unknown): asserts password is string {
  const groups = typeof password === "string"
    ? [/\p{Ll}/u, /\p{Lu}/u, /\p{Nd}/u, /[^\p{L}\p{N}\s]/u].filter(rule => rule.test(password)).length
    : 0;
  if (typeof password !== "string" || Array.from(password).length < 12 ||
      Array.from(password).length > 128 || password.trim() !== password || groups < 3) {
    throw validationError([{ field: "newPassword", issue: PASSWORD_RULES }]);
  }
}

export function normalizeEmail(email: unknown): string {
  if (typeof email !== "string" || Array.from(email.trim()).length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    throw validationError([{ field: "email", issue: "Enter a valid email address." }]);
  }
  return email.trim().toLowerCase();
}

export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try { return await argon2.verify(hash, password); } catch { return false; }
}

// Unknown/unprovisioned users still incur a password verification. Lazy generation
// keeps imports free of native work and never persists a usable dummy credential.
let dummyHash: Promise<string> | undefined;
export function getDummyPasswordHash(): Promise<string> {
  return dummyHash ??= hashPassword(randomBytes(32).toString("base64url"));
}
