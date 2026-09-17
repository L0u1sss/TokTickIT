import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { verifyPassword } from "../../src/password.js";
import { seedDatabase, LAB_INITIAL_PASSWORD } from "../../prisma/seed.js";

const admin = new PrismaClient();
const schemas: string[] = [];
const clients: PrismaClient[] = [];
const migrations = readdirSync("prisma/migrations").filter(x => /^\d/.test(x)).sort();
async function database(legacy = true) {
  const schema = "migration_test_" + randomUUID().replaceAll("-", "");
  await admin.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`); schemas.push(schema);
  const url = new URL(process.env.TEST_DATABASE_URL!); url.searchParams.set("schema", schema);
  const db = new PrismaClient({ datasources: { db: { url: url.toString() } } }); clients.push(db);
  const execute = (name: string) => execFileSync(process.execPath, [resolve("node_modules/prisma/build/index.js"), "db", "execute", "--stdin", "--schema", "prisma/schema.prisma"], {
    env: { ...process.env, DATABASE_URL: url.toString() }, stdio: ["pipe", "pipe", "pipe"],
    input: readFileSync(resolve("prisma/migrations", name, "migration.sql")),
  });
  for (const name of migrations.slice(0, legacy ? -1 : undefined)) execute(name);
  return { db, finish: () => execute(migrations.at(-1)!) };
}
beforeAll(async () => { await admin.$connect(); });
afterAll(async () => {
  for (const client of clients) await client.$disconnect();
  for (const schema of schemas) await admin.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
  await admin.$disconnect();
});

describe("Issue #31 disposable populated identity migration", () => {
  it("preserves requester IDs, activation, timestamps and all Ticket/Attachment audit fields", async () => {
    const { db, finish } = await database();
    await db.$executeRaw`INSERT INTO "RequesterUser" (id,"displayName",email,"isActive","updatedAt") VALUES (17,'Legacy Owner','legacy@example.test',true,'2026-01-01'),(18,'Inactive Owner','inactive@example.test',false,'2026-01-01')`;
    const category = await db.category.create({ data: { name: "Migration Category" } });
    const system = await db.relatedSystem.create({ data: { name: "Migration System" } });
    const ticket = await db.ticket.create({ data: { ticketNumber: "TKT-2026-000017", clientRequestId: randomUUID(), summary: "Legacy ticket", description: "Preserved legacy description", requestedPriority: "HIGH", requesterId: 17, categoryId: category.id, relatedSystemId: system.id } });
    const attachment = await db.attachment.create({ data: { ticketId: ticket.id, originalName: "legacy.pdf", storageKey: "opaque-migration-key", sizeBytes: 10, mimeType: "application/pdf", uploadedByRequesterId: 17, removedAt: new Date(), removalReason: "Replaced", removedByRequesterId: 18 } });
    finish();
    expect(await db.ticket.findUnique({ where: { id: ticket.id } })).toEqual(ticket);
    expect(await db.attachment.findUnique({ where: { id: attachment.id } })).toEqual(attachment);
    const user = await db.user.findUniqueOrThrow({ where: { id: 17 } });
    expect(user).toMatchObject({ displayName: "Legacy Owner", role: "REQUESTER", isActive: true, mustChangePassword: true, updatedAt: new Date("2026-01-01Z") });
    expect(await verifyPassword(user.passwordHash, LAB_INITIAL_PASSWORD)).toBe(true);
    expect((await db.user.findUniqueOrThrow({ where: { id: 18 } })).isActive).toBe(false);
    expect(await db.$queryRaw`SELECT table_name FROM information_schema.tables WHERE table_schema=current_schema() AND table_name='RequesterUser'`).toEqual([]);
    await expect(db.user.delete({ where: { id: 17 } })).rejects.toThrow("Ticket_requesterId_fkey");
    const added = await db.user.create({ data: { displayName: "New", email: "new@example.test", passwordHash: user.passwordHash, role: "IT_STAFF" } });
    expect(added.id).toBeGreaterThan(18);
  }, 60000);
  it.each(["id", "email"])("rolls back on an existing User %s collision without merging identities", async collision => {
    const { db, finish } = await database();
    await db.$executeRaw`INSERT INTO "RequesterUser" (id,"displayName",email,"updatedAt") VALUES (17,'Legacy','legacy@example.test',CURRENT_TIMESTAMP)`;
    await db.user.create({ data: { id: collision === "id" ? 17 : 99, displayName: "Existing", email: collision === "email" ? "legacy@example.test" : "other@example.test", passwordHash: "locked", role: "ADMINISTRATOR" } });
    expect(finish).toThrow();
    expect(await db.$queryRaw`SELECT id FROM "RequesterUser"`).toEqual([{ id: 17 }]);
    expect(await db.user.count()).toBe(1);
  }, 60000);
  it("supports fresh migration and repeated seed without resetting changed credentials/flags", async () => {
    const { db } = await database(false);
    await seedDatabase(db);
    expect(await db.user.count({ where: { role: "REQUESTER", isActive: true } })).toBe(4);
    expect(await db.user.count({ where: { role: "REQUESTER", isActive: false } })).toBe(1);
    expect(await db.user.count({ where: { role: "IT_STAFF", isActive: true } })).toBe(3);
    expect(await db.user.count({ where: { role: "IT_STAFF", isActive: false } })).toBe(1);
    expect(await db.user.count({ where: { role: "ADMINISTRATOR", isActive: true } })).toBe(1);
    const user = await db.user.findUniqueOrThrow({ where: { email: "jennifer.a@example.com" } });
    await db.user.update({ where: { id: user.id }, data: { passwordHash: "changed-hash", mustChangePassword: false, isActive: false } });
    const before = await db.user.findMany({ orderBy: { id: "asc" } });
    await seedDatabase(db);
    expect(await db.user.findMany({ orderBy: { id: "asc" } })).toEqual(before);
  }, 60000);
});
