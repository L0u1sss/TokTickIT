import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { loadEnvFile } from "node:process";
import { randomBytes, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";

const client= fileURLToPath(new URL("../",import.meta.url));
const server=path.resolve(client,"../server");
try {loadEnvFile(path.join(server,".env"));}catch { /* require explicit test environment below */ }
if(!process.env.TEST_DATABASE_URL)throw new Error("TEST_DATABASE_URL is required.");
const testUrl=new URL(process.env.TEST_DATABASE_URL);
if(!["postgres:","postgresql:"].includes(testUrl.protocol) ||
  !/(^|[^a-z0-9])(test|testing|ci|spec)([^a-z0-9]|$)/i.test(testUrl.pathname+"/"+(testUrl.searchParams.get("schema") ?? "public")))throw new Error("Use a dedicated test-marked PostgreSQL target.");
const identity=url=>[url.hostname.toLowerCase(),url.port||"5432",url.pathname,url.searchParams.get("schema")||"public"].join("/");
if(process.env.DATABASE_URL && identity(new URL(process.env.DATABASE_URL))===identity(testUrl))throw new Error("TEST_DATABASE_URL must differ from DATABASE_URL.");
const require=createRequire(path.join(server,"package.json"));
const {PrismaClient}=require("@prisma/client");
const argon2=require("argon2");
const admin=new PrismaClient({datasources:{db:{url:testUrl.toString()}}});
const schema="auth_e2e_test_"+randomBytes(8).toString("hex");
const isolated=new URL(testUrl);isolated.searchParams.set("schema",schema);
const db=new PrismaClient({datasources:{db:{url:isolated.toString()}}});
const apiPort=process.env.AUTH_E2E_API_PORT ?? "3101",webPort=process.env.AUTH_E2E_CLIENT_PORT ?? "4175";
const apiUrl=`http://127.0.0.1:${apiPort}`,clientUrl=`http://127.0.0.1:${webPort}`;
const password="Aa1!"+randomBytes(16).toString("hex");
const userManagement = process.argv.includes("--user-management");
const communications = process.argv.includes("--communications");
const staffFlow = process.argv.includes("--staff-flow");
const ticketWorkflow = process.argv.includes("--ticket-workflow");
const requesterDashboard = process.argv.includes("--requester-dashboard");
const staffQueue = process.argv.includes("--staff-queue") || communications || staffFlow || ticketWorkflow || requesterDashboard;
const children=[];
function start(entry,args,cwd,env,stdio="inherit"){
  const child=spawn(process.execPath,[entry,...args],{cwd,env:{...process.env,...env},stdio,windowsHide:true});
  const exit=new Promise((resolve,reject)=>{child.once("error",reject);child.once("exit",code=>resolve(code));});
  // Register immediately so startup failures still clean up every owned process.
  children.push({child,exit});return {child,exit};
}
async function run(entry,args,cwd,env){const {exit}=start(entry,args,cwd,env);if(await exit!==0)throw new Error("Verification process failed.");}
async function ready(url,child){
  for(let i=0;i<150;i++){
    if(child.exitCode!==null)throw new Error("Test service exited before startup.");
    try{if((await fetch(url)).ok)return;}catch{ /* startup */ }
    await new Promise(r=>setTimeout(r,200));
  }throw new Error("Test service startup timed out.");
}
let created=false;
let attachmentDirectory;
try{
  await admin.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);created=true;
  await run(path.join(server,"node_modules/prisma/build/index.js"),["migrate","deploy"],server,{DATABASE_URL:isolated.toString()});
  await db.user.create({data:{displayName:"Auth Browser User",email:"auth-browser@example.test",role:"REQUESTER",passwordHash:await argon2.hash(password,{type:argon2.argon2id}),mustChangePassword:true}});
  await db.user.create({data:{displayName:"Inactive Browser User",email:"inactive-browser@example.test",role:"REQUESTER",isActive:false,passwordHash:await argon2.hash(password,{type:argon2.argon2id}),mustChangePassword:false}});
  if (requesterDashboard) await db.user.create({ data: { displayName: "Empty Dashboard User", email: "empty-dashboard@example.test", role: "REQUESTER", passwordHash: await argon2.hash(password, { type: argon2.argon2id }), mustChangePassword: false } });
  if (userManagement) await db.user.create({ data: { displayName: "Mali Administrator", email: "admin-browser@example.test", role: "ADMINISTRATOR", passwordHash: await argon2.hash(password, { type: argon2.argon2id }), mustChangePassword: false } });
  if (staffQueue) {
    const staff = await db.user.create({ data: { displayName: "Mali IT Staff", email: "queue-browser@example.test", role: "IT_STAFF", passwordHash: await argon2.hash(password, { type: argon2.argon2id }), mustChangePassword: false } });
    if (staffFlow) await db.user.create({ data: { displayName: "Niran IT Staff", email: "second-staff@example.test", role: "IT_STAFF", passwordHash: await argon2.hash(password, { type: argon2.argon2id }), mustChangePassword: false } });
    const requester = await db.user.findUniqueOrThrow({ where: { email: "auth-browser@example.test" } });
    if (communications || staffFlow || ticketWorkflow || requesterDashboard) await db.user.update({ where: { id: requester.id }, data: { mustChangePassword: false } });
    const category = await db.category.create({ data: { name: "Hardware" } });
    const system = await db.relatedSystem.create({ data: { name: "Office services" } });
    if (staffFlow) attachmentDirectory = await mkdtemp(path.join(tmpdir(), "toktickit-staff-e2e-"));
    for (let i = 1; i <= 23; i++) {
      const dashboardStatus = requesterDashboard && i === 2 ? "WAITING_FOR_REQUESTER" : requesterDashboard && i === 3 ? "RESOLVED" : requesterDashboard && i === 4 ? "CLOSED" : i % 2 ? "OPEN" : "NEW";
      const ticket = await db.ticket.create({ data: {
      ticketNumber: `TKT-2026-${String(i).padStart(6, "0")}`, clientRequestId: randomUUID(), summary: i === 23 ? "Printer on floor 3 is offline" : `Office workstation ${i} needs support`,
      description: "The office printer cannot be reached from the shared network.", requesterId: requester.id, categoryId: category.id, relatedSystemId: system.id,
      requestedPriority: "HIGH", itPriority: "HIGH", status: dashboardStatus, ownerId: ["CLOSED", "CANCELLED"].includes(dashboardStatus) ? null : i % 2 ? staff.id : null,
    } });
      // Represent an existing staff adjustment after correct priority initialization.
      if (i % 2 === 0) await db.ticket.update({ where: { id: ticket.id }, data: { itPriority: "MEDIUM" } });
      if (staffFlow && i === 2) {
        const storageKey = randomUUID(), bytes = Buffer.from("%PDF-1.4\nStaff attachment continuity\n%%EOF");
        await writeFile(path.join(attachmentDirectory, storageKey), bytes);
        await db.attachment.create({ data: { ticketId: ticket.id, originalName: "existing.pdf", storageKey, sizeBytes: bytes.length, mimeType: "application/pdf", uploadedByRequesterId: requester.id } });
        await db.actionTaken.create({ data: { ticketId: ticket.id, clientRequestId: randomUUID(), description: "Existing completed staff work", result: "Connectivity restored", status: "COMPLETED", performedById: staff.id, assigneeId: staff.id, completedAt: new Date() } });
      }
    }
  }
  const api=start(path.join(server,"node_modules/tsx/dist/cli.mjs"),[path.join(server,"src/index.ts")],server,
    {DATABASE_URL:isolated.toString(),CLIENT_ORIGIN:clientUrl,PORT:apiPort,NODE_ENV:"test", ...(attachmentDirectory ? { ATTACHMENT_STORAGE_DIR: attachmentDirectory } : {})},"ignore");
  const web=start(path.join(client,"node_modules/vite/bin/vite.js"),["--host","127.0.0.1","--port",webPort,"--strictPort"],client,{VITE_API_URL:apiUrl},"ignore");
  await Promise.all([ready(apiUrl+"/api/health",api.child),ready(clientUrl,web.child)]);
  const browserSpec = userManagement ? "e2e/lab-03/user-administration.spec.ts" : requesterDashboard ? "e2e/lab-04/dashboards.spec.ts" : ticketWorkflow ? "e2e/lab-04/ticket-resolution.spec.ts" : staffFlow ? "e2e/lab-03/staff-ticket-flow.spec.ts" : communications ? "e2e/lab-03/comments-notes.spec.ts" : staffQueue ? "e2e/lab-03/staff-queue.spec.ts" : "e2e/lab-03/authentication.spec.ts";
  await run(path.join(client,"node_modules/@playwright/test/cli.js"),["test",browserSpec,"--config","playwright.live.config.ts"],client,
    {E2E_CLIENT_URL:clientUrl,E2E_API_URL:apiUrl,E2E_AUTH_PASSWORD:password});
}catch(error){console.error(error instanceof Error?error.message:"Auth E2E failed.");process.exitCode=1;}
finally{
  for(const {child} of children)if(child.exitCode===null)child.kill();
  await Promise.allSettled(children.map(({exit})=>exit));
  await db.$disconnect();
  if(created)await admin.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
  await admin.$disconnect();
  // Only remove the exact directory returned by mkdtemp for this runner.
  if (attachmentDirectory) await rm(attachmentDirectory, { recursive: true, force: true });
}
