import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import express from "express";
import request from "supertest";
import { createAuthRouter, requireAuthentication } from "../../src/auth-routes.js";
import { hashPassword } from "../../src/password.js";
import { provisionAuthAccount } from "../../src/auth-provision.js";
import { SESSION_COOKIE, tokenHash } from "../../src/auth-service.js";

const admin=new PrismaClient();
const schema="auth_test_"+randomUUID().replaceAll("-","");
let db:PrismaClient;
let app:ReturnType<typeof express>;
const initial="Initial-local-password1!";
const nextPassword="Replacement-password2!";
let userId:number;
let schemaCreated=false;
const origin="http://localhost:5173";
const cookie=(response:request.Response)=>{
  const value=response.headers["set-cookie"];
  return (Array.isArray(value)?value[0]:value as string).split(";")[0];
};
const signIn=(password=initial,email="auth@example.test")=>request(app).post("/api/auth/login").set("Origin",origin).send({email,password});

beforeAll(async()=>{
  // db-setup validates TEST_DATABASE_URL and switches DATABASE_URL before imports.
  await admin.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);schemaCreated=true;
  const url=new URL(process.env.TEST_DATABASE_URL!);url.searchParams.set("schema",schema);
  execFileSync(process.execPath,[resolve("node_modules/prisma/build/index.js"),"migrate","deploy"],{
    env:{...process.env,DATABASE_URL:url.toString()},stdio:"pipe",
  });
  execFileSync(process.execPath,[resolve("node_modules/prisma/build/index.js"),"migrate","diff",
    "--from-schema-datasource","prisma/schema.prisma","--to-schema-datamodel","prisma/schema.prisma","--exit-code"],{
    env:{...process.env,DATABASE_URL:url.toString()},stdio:"pipe",
  });
  db=new PrismaClient({datasources:{db:{url:url.toString()}}});
},60000);
beforeEach(async()=>{
  vi.stubEnv("NODE_ENV","test");vi.stubEnv("CLIENT_ORIGIN",origin);
  await db.session.deleteMany();await db.user.deleteMany();
  userId=(await db.user.create({data:{displayName:"Auth Requester",email:"auth@example.test",passwordHash:await hashPassword(initial),role:"REQUESTER"}})).id;
  app=express();app.use("/api/auth",createAuthRouter(()=>db));
  // Exercise the reusable guard independently of #31 Ticket-route cutover.
  app.get("/protected",requireAuthentication(()=>db),(_req,res)=>res.json({user:res.locals.authenticatedUser}));
});
afterAll(async()=>{
  vi.unstubAllEnvs();await db?.$disconnect();
  if(schemaCreated)await admin.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
  await admin.$disconnect();
});

describe("Issue #30 auth API with isolated PostgreSQL",()=>{
  it("does not charge successful logins against the failed-attempt budget",async()=>{
    for(let i=0;i<11;i++) expect((await signIn()).status).toBe(200);
    for(let i=0;i<10;i++) expect((await signIn("wrong")).status).toBe(401);
    expect((await signIn()).status).toBe(429);
  });
  it("uses the same safe envelope for guard failures, including synchronous database failure",async()=>{
    const missing=await request(app).get("/protected");
    expect(missing.status).toBe(401);
    expect(missing.body.error.requestId).toEqual(expect.any(String));
    const forced=await request(app).get("/protected").set("Cookie",cookie(await signIn()));
    expect(forced.status).toBe(403);
    expect(forced.body.error.requestId).toEqual(expect.any(String));
    const failed=express();
    failed.get("/protected",requireAuthentication(()=>{throw new Error("database secret");}));
    const response=await request(failed).get("/protected");
    expect(response.status).toBe(500);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.body.error).toEqual({code:"INTERNAL_ERROR",message:"The request could not be completed.",requestId:expect.any(String)});
  });
  it("provisions a local account once and preserves changed credentials and role on rerun",async()=>{
    const input={email:"local-auth@example.test",displayName:"Local Auth",role:"IT_STAFF"};
    const result=await provisionAuthAccount(db,input);expect(result.created).toBe(true);
    const row=await db.user.findUniqueOrThrow({where:{email:input.email}});
    expect(row.passwordHash).toMatch(/^\$argon2id\$/);expect(row.mustChangePassword).toBe(true);
    if(result.created)expect((await signIn(result.password,result.email)).status).toBe(200);
    await db.user.update({where:{id:row.id},data:{passwordHash:await hashPassword(nextPassword),mustChangePassword:false,role:"ADMINISTRATOR",isActive:false}});
    const before=await db.user.findUniqueOrThrow({where:{id:row.id}});
    expect(await provisionAuthAccount(db,input)).toEqual({created:false,email:input.email});
    expect(await db.user.findUniqueOrThrow({where:{id:row.id}})).toEqual(before);
  });
  it("logs in canonically, stores only token hash and returns safe identity/cookie",async()=>{
    const response=await signIn(initial,"  AUTH@Example.Test  ");
    expect(response.status).toBe(200);
    expect(response.body.user).toEqual({id:userId,displayName:"Auth Requester",email:"auth@example.test",role:"REQUESTER",mustChangePassword:true});
    expect(response.headers["set-cookie"][0]).toMatch(/HttpOnly/);
    expect(response.headers["set-cookie"][0]).toMatch(/SameSite=Lax/);
    expect(response.headers["set-cookie"][0]).toMatch(/Path=\//);
    const token=cookie(response).split("=")[1];
    const row=await db.session.findFirstOrThrow();
    expect(row.tokenHash).toBe(tokenHash(token));expect(row.tokenHash).not.toBe(token);
    expect(row.expiresAt.getTime()-Date.now()).toBeLessThanOrEqual(8*3600000);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.headers["access-control-allow-credentials"]).toBe("true");
    expect((await request(app).get("/api/auth/me").set("Cookie",cookie(response))).body).toEqual(response.body);
  });
  it("uses Secure outside local/test environments",async()=>{
    vi.stubEnv("NODE_ENV","production");
    expect((await signIn()).headers["set-cookie"][0]).toContain("Secure");
  });
  it("returns indistinguishable failures for unknown, wrong and inactive credentials",async()=>{
    const responses=[await signIn(initial,"missing@example.test"),await signIn("Wrong-password1!")];
    await db.user.update({where:{id:userId},data:{isActive:false}});
    responses.push(await signIn(),await signIn("Wrong-password1!"));
    for(const response of responses){
      expect(response.status).toBe(401);expect(response.headers["set-cookie"]).toBeUndefined();
      expect(response.body.error).toEqual({code:"AUTHENTICATION_FAILED",message:"Unable to sign in with the provided credentials.",requestId:expect.any(String)});
    }
    expect(await db.session.count()).toBe(0);
  });
  it("rejects missing/cross-site Origin before malformed JSON or credential checks",async()=>{
    for(const path of ["login","change-password","logout"])for(const supplied of [undefined,"http://evil.example"]){
      let call=request(app).post(`/api/auth/${path}`).set("Content-Type","application/json");
      if(supplied)call=call.set("Origin",supplied);
      const response=await call.send("{");
      expect(response.status).toBe(403);expect(response.body.error.code).toBe("ORIGIN_NOT_ALLOWED");
    }
  });
  it.each(["IT_STAFF","ADMINISTRATOR"] as const)("returns the authenticated %s role without credential fields",async role=>{
    await db.user.update({where:{id:userId},data:{role}});
    const response=await signIn();expect(response.status).toBe(200);expect(response.body.user.role).toBe(role);
    expect(response.body.user).not.toHaveProperty("passwordHash");
  });
  it("accepts exact password boundaries including 128 Unicode code points",async()=>{
    let session=cookie(await signIn()),currentPassword=initial;
    for(const newPassword of ["Abcdefghij1!","Aa1"+"😀".repeat(125)]){
      const response=await request(app).post("/api/auth/change-password").set("Cookie",session).set("Origin",origin)
        .send({currentPassword,newPassword,confirmPassword:newPassword});
      expect(response.status).toBe(200);session=cookie(response);currentPassword=newPassword;
      expect((await signIn(newPassword)).status).toBe(200);
    }
  });
  it("validates malformed JSON, extra fields, email and password boundaries",async()=>{
    for(const body of [{email:"bad",password:initial},{email:"auth@example.test",password:"x".repeat(129)},
      {email:"auth@example.test",password:initial,role:"ADMINISTRATOR"},[]]){
      expect((await request(app).post("/api/auth/login").set("Origin",origin).send(body)).status).toBe(400);
    }
    const malformed=await request(app).post("/api/auth/login").set("Origin",origin).set("Content-Type","application/json").send("{");
    expect(malformed.status).toBe(400);expect(malformed.body.error.code).toBe("VALIDATION_ERROR");
  });
  it("limits attempts by IP and canonical email and exposes Retry-After",async()=>{
    for(let i=0;i<10;i++)expect((await signIn("wrong","UNKNOWN@example.test")).status).toBe(401);
    const response=await signIn("wrong"," unknown@example.test ");
    expect(response.status).toBe(429);expect(response.body.error.code).toBe("TOO_MANY_ATTEMPTS");
    expect(Number(response.headers["retry-after"])).toBeGreaterThan(0);
  });
  it("rejects missing, malformed, expired, revoked and deactivated sessions",async()=>{
    expect((await request(app).get("/api/auth/me")).status).toBe(401);
    expect((await request(app).get("/api/auth/me").set("Cookie",`${SESSION_COOKIE}=bad`)).status).toBe(401);
    for(const mode of ["expired","revoked","inactive"]){
      const response=await signIn();const token=cookie(response);
      if(mode==="expired")await db.session.updateMany({data:{expiresAt:new Date(0)}});
      if(mode==="revoked")await db.session.updateMany({data:{revokedAt:new Date()}});
      if(mode==="inactive")await db.user.update({where:{id:userId},data:{isActive:false}});
      expect((await request(app).get("/api/auth/me").set("Cookie",token)).status).toBe(401);
    }
  });
  it("enforces forced change, rotates current token and invalidates all other sessions",async()=>{
    const first=cookie(await signIn()),second=cookie(await signIn());
    expect((await request(app).get("/protected").set("Cookie",first)).body.error.code).toBe("PASSWORD_CHANGE_REQUIRED");
    const response=await request(app).post("/api/auth/change-password").set("Cookie",first).set("Origin",origin)
      .send({currentPassword:initial,newPassword:nextPassword,confirmPassword:nextPassword});
    expect(response.status).toBe(200);expect(response.body.user.mustChangePassword).toBe(false);
    expect(cookie(response)).not.toBe(first);expect(await db.session.count()).toBe(1);
    for(const old of [first,second])expect((await request(app).get("/api/auth/me").set("Cookie",old)).status).toBe(401);
    expect((await request(app).get("/protected").set("Cookie",cookie(response))).status).toBe(200);
    expect((await signIn()).status).toBe(401);expect((await signIn(nextPassword)).status).toBe(200);
  });
  it("rejects confirmation, weak password, wrong current password and reuse without mutation",async()=>{
    const session=cookie(await signIn());const before=await db.user.findUniqueOrThrow({where:{id:userId}});
    for(const [currentPassword,newPassword,confirmPassword,status] of [
      [initial,nextPassword,"different",400],[initial,"short","short",400],
      ["wrong",nextPassword,nextPassword,401],[initial,initial,initial,409],
    ] as const){
      const response=await request(app).post("/api/auth/change-password").set("Cookie",session).set("Origin",origin).send({currentPassword,newPassword,confirmPassword});
      expect(response.status).toBe(status);
    }
    expect((await db.user.findUniqueOrThrow({where:{id:userId}})).passwordHash).toBe(before.passwordHash);
    expect((await request(app).get("/api/auth/me").set("Cookie",session)).status).toBe(200);
  });
  it("logs out idempotently and prevents direct protected access using the old cookie",async()=>{
    const session=cookie(await signIn());
    for(let i=0;i<2;i++){
      const response=await request(app).post("/api/auth/logout").set("Cookie",session).set("Origin",origin).send({});
      expect(response.status).toBe(204);expect(response.headers["set-cookie"][0]).toContain("Expires=Thu, 01 Jan 1970");
    }
    expect((await request(app).post("/api/auth/logout").set("Origin",origin).send({})).status).toBe(204);
    expect((await request(app).get("/protected").set("Cookie",session)).status).toBe(401);
    expect(await db.session.count()).toBe(0);
  });
  it("allows only one concurrent password change from a session",async()=>{
    const session=cookie(await signIn());
    const change=()=>request(app).post("/api/auth/change-password").set("Cookie",session).set("Origin",origin)
      .send({currentPassword:initial,newPassword:nextPassword,confirmPassword:nextPassword});
    const responses=await Promise.all([change(),change()]);
    expect(responses.map(r=>r.status).sort()).toEqual([200,401]);expect(await db.session.count()).toBe(1);
  });
  it("returns a safe 500 envelope without database secrets",async()=>{
    const failed=express();failed.use("/api/auth",createAuthRouter(()=>{throw new Error("database secret");}));
    const response=await request(failed).get("/api/auth/me").set("Cookie",`${SESSION_COOKIE}=${"x".repeat(43)}`);
    expect(response.status).toBe(500);expect(response.body.error.code).toBe("INTERNAL_ERROR");
    expect(JSON.stringify(response.body)).not.toContain("database secret");
  });
});
