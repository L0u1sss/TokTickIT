import type { PrismaClient, UserRole } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { hashPassword, normalizeEmail } from "./password.js";

/** Explicit local-lab setup, never called at server startup. No reset on rerun. */
export async function provisionAuthAccount(prisma:PrismaClient, input:{email:string;displayName:string;role:string}) {
  const email=normalizeEmail(input.email);
  const displayName=input.displayName.trim();
  if(!displayName || Array.from(displayName).length>120)throw new Error("Name must contain 1–120 characters.");
  if(!["REQUESTER","IT_STAFF","ADMINISTRATOR"].includes(input.role))throw new Error("Choose REQUESTER, IT_STAFF or ADMINISTRATOR.");
  const password="Aa1!"+randomBytes(24).toString("base64url");
  const passwordHash=await hashPassword(password);
  return prisma.$transaction(async tx=>{
    await tx.$executeRaw`LOCK TABLE "User" IN SHARE ROW EXCLUSIVE MODE`;
    const existing=await tx.user.findUnique({where:{email}});
    if(existing)return {created:false as const,email};
    const users=await tx.user.aggregate({_max:{id:true}});
    const id=(users._max.id ?? 0)+1;
    await tx.user.create({data:{id,email,displayName,role:input.role as UserRole,passwordHash,mustChangePassword:true}});
    await tx.$queryRaw`SELECT setval(pg_get_serial_sequence('"User"', 'id'), ${id}, true)`;
    return {created:true as const,email,password};
  });
}
