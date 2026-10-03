import { execFileSync, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";

const root = fileURLToPath(new URL("../", import.meta.url));
const output = path.join(root, "artifacts/lab-04/issue-61/fresh-clone");
await mkdir(output, { recursive: true });
try { loadEnvFile(path.join(root, "server/.env")); } catch { /* Environment may already be supplied. */ }
const testUrl = new URL(process.env.TEST_DATABASE_URL ?? "missing-test-database");
if (!/^postgres(ql)?:$/.test(testUrl.protocol) || !/(^|[^a-z0-9])(test|testing|ci|spec)([^a-z0-9]|$)/i.test(`${testUrl.pathname}/${testUrl.searchParams.get("schema") ?? "public"}`)) {
  throw new Error("Use an explicitly test-marked PostgreSQL target.");
}
const target = url => [url.hostname, url.port || "5432", url.pathname, url.searchParams.get("schema") ?? "public"].join("/");
if (process.env.DATABASE_URL && target(testUrl) === target(new URL(process.env.DATABASE_URL))) throw new Error("Test and development targets must differ.");
const require = createRequire(path.join(root, "server/package.json"));
const { PrismaClient } = require("@prisma/client");
const admin = new PrismaClient({ datasources: { db: { url: testUrl.toString() } } });
const schema = "fresh_clone_test_" + randomUUID().replaceAll("-", "");
const clone = path.join(os.tmpdir(), "toktickit-lab4-fresh-" + randomUUID());
const git = args => execFileSync("git", args, { cwd: root, encoding: "utf8", windowsHide: true }).trim();
const manifest = { startedAt: new Date().toISOString(), sourceSha: git(["rev-parse", "HEAD"]), branch: git(["branch", "--show-current"]),
  cloneSource: "Local committed repository via git clone --no-hardlinks; no uncommitted files, node_modules or .env copied.",
  cloneDirectory: clone, fixtureSchema: schema, node: process.version, results: [], allPassed: false };
const npm = path.join(path.dirname(process.execPath), "node_modules/npm/bin/npm-cli.js");
let created = false;
let api;
async function command(id, executable, args, cwd, env = process.env) {
  console.info(`Fresh clone: ${id}`);
  const child = spawn(executable, args, { cwd, env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  let log = "";
  for (const stream of [child.stdout, child.stderr]) { stream.setEncoding("utf8"); stream.on("data", data => { log += data; }); }
  const exitCode = await new Promise((resolve, reject) => { child.once("error", reject); child.once("close", code => resolve(code ?? 1)); });
  // Do not write connection strings, even if a tool includes them in diagnostic output.
  log = log.replace(/postgres(?:ql)?:\/\/[^\s"']+/gi, "[redacted PostgreSQL connection]");
  await writeFile(path.join(output, `${id}.txt`), log);
  manifest.results.push({ id, status: exitCode === 0 ? "PASS" : "FAIL", exitCode, log: `${id}.txt` });
  if (exitCode) throw new Error(`${id} failed; inspect its redacted log.`);
}
try {
  await command("clone", "git", ["clone", "--no-hardlinks", "--single-branch", "--branch", manifest.branch, root, clone], root);
  const installs = await Promise.allSettled([command("install-server", process.execPath, [npm, "ci"], path.join(clone, "server")),
    command("install-client", process.execPath, [npm, "ci"], path.join(clone, "client"))]);
  for (const result of installs) if (result.status === "rejected") throw result.reason;
  await admin.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`); created = true;
  testUrl.searchParams.set("schema", schema);
  const env = { ...process.env, DATABASE_URL: testUrl.toString(), TEST_DATABASE_URL: testUrl.toString(), CLIENT_ORIGIN: "http://localhost:5173", NODE_ENV: "development", SEED_REFERENCE_DATA_ONLY: "false" };
  const server = path.join(clone, "server");
  const prisma = path.join(server, "node_modules/prisma/build/index.js");
  await command("prisma-generate", process.execPath, [prisma, "generate"], server, env);
  await command("migrate-deploy", process.execPath, [prisma, "migrate", "deploy"], server, env);
  await command("seed-first", process.execPath, [npm, "run", "prisma:seed"], server, env);
  const db = new PrismaClient({ datasources: { db: { url: testUrl.toString() } } });
  try {
    const snapshot = async () => ({ users: await db.user.findMany({ orderBy: { id: "asc" } }),
      tickets: await db.ticket.findMany({ orderBy: { id: "asc" } }), actions: await db.actionTaken.findMany({ orderBy: { id: "asc" } }) });
    const first = await snapshot();
    await command("seed-repeat", process.execPath, [npm, "run", "prisma:seed"], server, env);
    const second = await snapshot();
    manifest.seed = { users: first.users.length, tickets: first.tickets.length, actions: first.actions.length,
      credentialsAndRecordsUnchanged: JSON.stringify(first) === JSON.stringify(second) };
    if (first.users.length !== 10 || first.tickets.length !== 8 || first.actions.length !== 6) throw new Error("Unexpected README demo seed counts; expected 10 Users, 8 Tickets and 6 Actions.");
    if (!manifest.seed.credentialsAndRecordsUnchanged) throw new Error("Repeated seed changed existing records or credentials.");
  } finally { await db.$disconnect(); }
  await command("build-server", process.execPath, [npm, "run", "build"], server, env);
  await command("build-client", process.execPath, [npm, "run", "build"], path.join(clone, "client"), env);
  // Use an ephemeral port and the freshly installed, built API, rather than an existing dev service.
  const net = await import("node:net");
  const port = await new Promise((resolve, reject) => { const listener = net.createServer(); listener.once("error", reject);
    listener.listen(0, "127.0.0.1", () => { const value = listener.address().port; listener.close(() => resolve(value)); }); });
  api = spawn(process.execPath, [path.join(server, "dist/src/index.js")], { cwd: server, env: { ...env, PORT: String(port) }, windowsHide: true, stdio: "ignore" });
  let response;
  for (let attempt = 0; attempt < 60; attempt++) {
    try { response = await fetch(`http://127.0.0.1:${port}/api/health`); if (response.ok) break; } catch { /* Wait for startup. */ }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  if (!response?.ok) throw new Error("Freshly built API did not become healthy.");
  manifest.health = { status: response.status, body: await response.json() };
  if (manifest.health.body.status !== "ok") throw new Error("Unexpected health payload.");
  manifest.allPassed = true;
} catch (error) {
  manifest.error = error.message; process.exitCode = 1;
} finally {
  if (api) { api.kill(); await new Promise(resolve => { if (api.exitCode !== null) resolve(); else api.once("close", resolve); }); }
  if (created) await admin.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
  await admin.$disconnect();
  manifest.fixtureSchemaRemoved = created;
  manifest.finishedAt = new Date().toISOString();
  await writeFile(path.join(output, "verification.json"), JSON.stringify(manifest, null, 2) + "\n");
  console.info(`Fresh clone: ${manifest.allPassed ? "PASS" : "FAIL"}`);
}
