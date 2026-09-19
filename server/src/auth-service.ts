import { createHash, randomBytes } from "node:crypto";
import type { PrismaClient, User } from "@prisma/client";
import { ApiError, validationError } from "./errors.js";
import { getDummyPasswordHash, hashPassword, normalizeEmail, validateNewPassword, verifyPassword } from "./password.js";

export const SESSION_COOKIE = "toktickit_session";
export const SESSION_MAX_AGE = 8 * 60 * 60 * 1000;
export const LOGIN_FAILURE = "Unable to sign in with the provided credentials.";
export const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");
const newToken = () => randomBytes(32).toString("base64url");
export const currentUser = (user: User) => ({
  id: user.id, displayName: user.displayName, email: user.email,
  role: user.role, mustChangePassword: user.mustChangePassword,
});
export function authenticationRequired() {
  return new ApiError(401, "AUTHENTICATION_REQUIRED", "Sign in to continue.");
}

export function parseAuthBody(body: unknown, fields: string[]): Record<string,string> {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw validationError([{field:"form",issue:"Send a JSON object."}]);
  const data = body as Record<string,unknown>;
  const invalid = Object.keys(data).filter(k=>!fields.includes(k));
  for (const field of fields) {
    if (typeof data[field] !== "string" || !data[field] ||
        Array.from(data[field] as string).length > (field === "email" ? 512 : 128)) invalid.push(field);
  }
  if(invalid.length) throw validationError(invalid.map(field=>({field,issue:"Enter a valid value; password fields allow at most 128 characters."})));
  return data as Record<string,string>;
}

export async function login(prisma: PrismaClient, emailInput: string, password: string, oldToken?: string) {
  const email = normalizeEmail(emailInput);
  const user = await prisma.user.findUnique({where:{email}});
  const hash = user?.passwordHash ?? await getDummyPasswordHash();
  const valid = await verifyPassword(hash,password);
  if(!user || !valid || !user.isActive) throw new ApiError(401,"AUTHENTICATION_FAILED",LOGIN_FAILURE);
  const token = newToken();
  // Same User row lock is used by change-password so a concurrent login cannot
  // recreate a session using a credential that has just been replaced.
  return prisma.$transaction(async tx=>{
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${user.id} FOR UPDATE`;
    const latest = await tx.user.findUniqueOrThrow({where:{id:user.id}});
    if(!latest.isActive || latest.passwordHash !== hash) throw new ApiError(401,"AUTHENTICATION_FAILED",LOGIN_FAILURE);
    if(oldToken) await tx.session.deleteMany({where:{tokenHash:tokenHash(oldToken)}});
    await tx.session.create({data:{userId:user.id,tokenHash:tokenHash(token),expiresAt:new Date(Date.now()+SESSION_MAX_AGE)}});
    return {user:currentUser(latest),token};
  });
}

export async function authenticate(prisma: PrismaClient, token?: string) {
  if(!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) throw authenticationRequired();
  const session = await prisma.session.findUnique({where:{tokenHash:tokenHash(token)},include:{user:true}});
  if(!session || session.revokedAt || session.expiresAt.getTime()<=Date.now() || !session.user.isActive) {
    if(session) await prisma.session.deleteMany({where:{id:session.id}});
    throw authenticationRequired();
  }
  return session;
}

export async function changePassword(prisma: PrismaClient, token: string | undefined, body: unknown) {
  const session = await authenticate(prisma,token);
  const input = parseAuthBody(body,["currentPassword","newPassword","confirmPassword"]);
  validateNewPassword(input.newPassword);
  if(input.newPassword!==input.confirmPassword) throw validationError([{field:"confirmPassword",issue:"Passwords must match."}]);
  if(!await verifyPassword(session.user.passwordHash,input.currentPassword)) throw new ApiError(401,"CURRENT_PASSWORD_INCORRECT","Current password is incorrect.");
  if(input.currentPassword===input.newPassword) throw new ApiError(409,"PASSWORD_REUSE_NOT_ALLOWED","Choose a different password.");
  const passwordHash = await hashPassword(input.newPassword);
  const replacement = newToken();
  return prisma.$transaction(async tx=>{
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${session.userId} FOR UPDATE`;
    // Logout and changes revoke the session before this point or wait on this lock.
    const live = await tx.session.findUnique({where:{id:session.id},include:{user:true}});
    if(!live || live.revokedAt || live.expiresAt.getTime()<=Date.now() || !live.user.isActive ||
       live.user.passwordHash!==session.user.passwordHash) throw authenticationRequired();
    const user = await tx.user.update({where:{id:session.userId},data:{passwordHash,mustChangePassword:false}});
    await tx.session.deleteMany({where:{userId:user.id}});
    await tx.session.create({data:{userId:user.id,tokenHash:tokenHash(replacement),expiresAt:new Date(Date.now()+SESSION_MAX_AGE)}});
    return {user:currentUser(user),token:replacement};
  });
}

export async function logout(prisma: PrismaClient, token?: string) {
  if(!token) return;
  await prisma.$transaction(async tx=>{
    const session=await tx.session.findUnique({where:{tokenHash:tokenHash(token)}});
    if(!session)return;
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${session.userId} FOR UPDATE`;
    await tx.session.deleteMany({where:{id:session.id}});
  });
}
