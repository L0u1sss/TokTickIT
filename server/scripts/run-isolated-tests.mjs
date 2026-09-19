import { loadEnvFile } from "node:process";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
try { loadEnvFile(".env"); } catch { /* CI supplies environment */ }
const url = new URL(process.env.TEST_DATABASE_URL ?? "missing-test-database");
const label = `${url.pathname}/${url.searchParams.get("schema") ?? "public"}`;
if (!/^postgres(ql)?:$/.test(url.protocol) || !/(^|[^a-z0-9])(test|testing|ci|spec)([^a-z0-9]|$)/i.test(label)) throw new Error("Use an explicitly test-marked PostgreSQL target.");
if (process.env.DATABASE_URL) {
  const development = new URL(process.env.DATABASE_URL);
  const target = u => [u.hostname, u.port || "5432", u.pathname, u.searchParams.get("schema") ?? "public"].join("/");
  if (target(url) === target(development)) throw new Error("Test and development targets must differ.");
}
const admin = new PrismaClient({ datasources: { db: { url: url.toString() } } });
const schema = "suite_test_" + randomUUID().replaceAll("-", "");
let created = false;
try {
  await admin.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`); created = true;
  url.searchParams.set("schema", schema);
  const env = { ...process.env, TEST_DATABASE_URL: url.toString() };
  const command = (args, extra = {}) => execFileSync(process.execPath, args, { env: { ...env, ...extra }, stdio: "inherit" });
  command([resolve("node_modules/prisma/build/index.js"), "migrate", "deploy"], { DATABASE_URL: url.toString() });
  command([resolve("node_modules/tsx/dist/cli.mjs"), "prisma/seed.ts"], { DATABASE_URL: url.toString() });
  command([resolve("node_modules/vitest/vitest.mjs"), "run", ...process.argv.slice(2)]);
} catch { process.exitCode = 1; }
finally {
  if (created) await admin.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
  await admin.$disconnect();
}
