import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { seedDatabase } from "../../prisma/seed.js";

const migrationName = "20260925000000_actions_taken_foundation";
const migrations = readdirSync("prisma/migrations").filter(name => /^\d/.test(name)).sort();
const admin = new PrismaClient();
const schemas: string[] = [];
const clients: PrismaClient[] = [];

function executeSql(url: string, sql: string) {
  execFileSync(process.execPath, [resolve("node_modules/prisma/build/index.js"), "db", "execute", "--stdin", "--schema", "prisma/schema.prisma"], {
    env: { ...process.env, DATABASE_URL: url },
    stdio: ["pipe", "pipe", "pipe"],
    input: sql,
  });
}

async function disposableDatabase(includeLab4: boolean) {
  const schema = "lab4_migration_test_" + randomUUID().replaceAll("-", "");
  await admin.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
  schemas.push(schema);
  const url = new URL(process.env.TEST_DATABASE_URL!);
  url.searchParams.set("schema", schema);
  const databaseUrl = url.toString();
  const db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  clients.push(db);
  const end = migrations.indexOf(migrationName);
  if (end < 0) throw new Error(`Migration not found: ${migrationName}`);
  for (const name of migrations.slice(0, includeLab4 ? undefined : end)) {
    executeSql(databaseUrl, readFileSync(resolve("prisma/migrations", name, "migration.sql"), "utf8"));
  }
  return {
    db,
    databaseUrl,
    applyLab4: () => executeSql(databaseUrl, readFileSync(resolve("prisma/migrations", migrationName, "migration.sql"), "utf8")),
    rollbackBeforeUse: () => executeSql(databaseUrl, readFileSync(resolve("prisma/migrations", migrationName, "rollback-before-use.sql"), "utf8")),
  };
}

async function seedLab3References(db: PrismaClient) {
  const requester = await db.user.create({ data: { displayName: "Legacy Requester", email: `legacy-requester-${randomUUID()}@example.test`, passwordHash: "legacy-hash", role: "REQUESTER" } });
  const staff = await db.user.create({ data: { displayName: "Legacy Staff", email: `legacy-staff-${randomUUID()}@example.test`, passwordHash: "legacy-hash", role: "IT_STAFF" } });
  const category = await db.category.create({ data: { name: `Legacy Category ${randomUUID()}` } });
  const system = await db.relatedSystem.create({ data: { name: `Legacy System ${randomUUID()}` } });
  return { requester, staff, category, system };
}

beforeAll(async () => admin.$connect());
afterAll(async () => {
  for (const client of clients) await client.$disconnect();
  for (const schema of schemas) await admin.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
  await admin.$disconnect();
});

describe("Issue #53 Actions Taken migration", () => {
  it("preserves populated Lab 3 rows and leaves legacy Tickets with zero Actions", async () => {
    const { db, applyLab4 } = await disposableDatabase(false);
    const { requester, staff, category, system } = await seedLab3References(db);
    const ticket = await db.ticket.create({ data: {
      ticketNumber: "TKT-2099-000001", clientRequestId: randomUUID(), summary: "Legacy Lab 3 Ticket",
      description: "All existing data and relationships must survive.", requestedPriority: "HIGH", itPriority: "MEDIUM",
      status: "IN_PROGRESS", requesterId: requester.id, ownerId: staff.id, categoryId: category.id, relatedSystemId: system.id,
    } });
    const attachment = await db.attachment.create({ data: { ticketId: ticket.id, originalName: "legacy.pdf", storageKey: randomUUID(), sizeBytes: 12, mimeType: "application/pdf", uploadedByRequesterId: requester.id } });
    const comment = await db.publicComment.create({ data: { ticketId: ticket.id, authorId: requester.id, content: "Existing public comment" } });
    const note = await db.internalNote.create({ data: { ticketId: ticket.id, authorId: staff.id, content: "Existing internal note" } });
    const before = {
      users: await db.user.findMany({ orderBy: { id: "asc" } }),
      tickets: await db.ticket.findMany({ orderBy: { id: "asc" } }),
      attachments: await db.attachment.findMany({ orderBy: { id: "asc" } }),
      comments: await db.publicComment.findMany({ orderBy: { id: "asc" } }),
      notes: await db.internalNote.findMany({ orderBy: { id: "asc" } }),
    };

    applyLab4();

    expect(await db.user.findMany({ orderBy: { id: "asc" } })).toEqual(before.users);
    expect(await db.ticket.findMany({ orderBy: { id: "asc" } })).toEqual(before.tickets);
    expect(await db.attachment.findMany({ orderBy: { id: "asc" } })).toEqual(before.attachments);
    expect(await db.publicComment.findMany({ orderBy: { id: "asc" } })).toEqual(before.comments);
    expect(await db.internalNote.findMany({ orderBy: { id: "asc" } })).toEqual(before.notes);
    expect(await db.actionTaken.count()).toBe(0);
    expect(await db.actionEvent.count()).toBe(0);
    await expect(db.ticket.delete({ where: { id: ticket.id } })).rejects.toThrow();
    expect(await db.attachment.findUnique({ where: { id: attachment.id } })).toEqual(attachment);
    expect(await db.publicComment.findUnique({ where: { id: comment.id } })).toEqual(comment);
    expect(await db.internalNote.findUnique({ where: { id: note.id } })).toEqual(note);
  }, 60000);

  it("supports fresh deployment and repeated seed without overwriting seeded records", async () => {
    const { db } = await disposableDatabase(true);
    await seedDatabase(db);
    expect(await db.ticket.count({ where: { ticketNumber: { startsWith: "TKT-2026-9" } } })).toBe(8);
    expect(await db.actionTaken.count()).toBe(5);
    expect(await db.actionEvent.count()).toBe(5);
    const audited = await db.actionTaken.findFirstOrThrow({ include: { performedBy: true, assignee: true, events: { include: { actor: true } } } });
    expect(audited.revision).toBe(1);
    expect(audited.performedBy.id).toBeGreaterThan(0);
    expect(audited.assignee.id).toBeGreaterThan(0);
    expect(audited.events).toHaveLength(1);
    expect(audited.events[0]).toMatchObject({ eventType: "CREATED", revision: 1, actorId: audited.performedById });
    await expect(db.actionTaken.create({ data: {
      ticketId: audited.ticketId, clientRequestId: randomUUID(), description: "Missing conditional note",
      performedById: audited.performedById, assigneeId: audited.assigneeId, followUpRequired: true,
    } })).rejects.toThrow();
    await expect(db.actionTaken.create({ data: {
      ticketId: audited.ticketId, clientRequestId: randomUUID(), description: "Invalid completion",
      performedById: audited.performedById, assigneeId: audited.assigneeId, status: "COMPLETED",
    } })).rejects.toThrow();
    await expect(db.actionTaken.create({ data: {
      ticketId: audited.ticketId, clientRequestId: audited.clientRequestId, description: "Duplicate retry identity",
      performedById: audited.performedById, assigneeId: audited.assigneeId,
    } })).rejects.toThrow();
    expect(new Set((await db.ticket.findMany({ where: { ticketNumber: { startsWith: "TKT-2026-9" } }, select: { status: true } })).map(ticket => ticket.status))).toEqual(new Set(["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CLOSED", "REOPENED", "CANCELLED"]));
    expect(new Set((await db.ticket.findMany({ where: { ticketNumber: { startsWith: "TKT-2026-9" } }, select: { itPriority: true } })).map(ticket => ticket.itPriority))).toEqual(new Set(["LOW", "MEDIUM", "HIGH"]));
    expect(await db.ticket.count({ where: { ticketNumber: { startsWith: "TKT-2026-9" }, ownerId: null } })).toBeGreaterThan(0);
    expect(await db.ticket.count({ where: { ticketNumber: { startsWith: "TKT-2026-9" }, ownerId: { not: null } } })).toBeGreaterThan(0);
    const counts = await db.ticket.findMany({ where: { ticketNumber: { startsWith: "TKT-2026-9" } }, select: { ticketNumber: true, _count: { select: { actions: true } } } });
    expect(counts.some(ticket => ticket._count.actions === 0)).toBe(true);
    expect(counts.some(ticket => ticket._count.actions === 1)).toBe(true);
    expect(counts.some(ticket => ticket._count.actions > 1)).toBe(true);

    const changedAction = await db.actionTaken.findFirstOrThrow();
    await db.actionTaken.update({ where: { id: changedAction.id }, data: { description: "Locally reviewed description", revision: 2 } });
    const changedTicket = await db.ticket.findFirstOrThrow({ where: { ticketNumber: "TKT-2026-900001" } });
    await db.ticket.update({ where: { id: changedTicket.id }, data: { summary: "Locally reviewed summary" } });
    await seedDatabase(db);
    expect(await db.actionTaken.count()).toBe(5);
    expect(await db.actionEvent.count()).toBe(5);
    expect(await db.actionTaken.findUniqueOrThrow({ where: { id: changedAction.id } })).toMatchObject({ description: "Locally reviewed description", revision: 2 });
    expect(await db.ticket.findUniqueOrThrow({ where: { id: changedTicket.id } })).toMatchObject({ summary: "Locally reviewed summary" });
  }, 60000);

  it("tests guarded pre-use rollback and forward recovery without touching Lab 3 data", async () => {
    const { db, applyLab4, rollbackBeforeUse } = await disposableDatabase(false);
    const { requester, staff, category, system } = await seedLab3References(db);
    await db.ticket.create({ data: {
      ticketNumber: "TKT-2099-000002", clientRequestId: randomUUID(), summary: "Recovery Ticket",
      description: "Existing Ticket remains through rollback and recovery.", requestedPriority: "LOW", itPriority: "LOW",
      requesterId: requester.id, categoryId: category.id, relatedSystemId: system.id,
    } });
    const originalUsers = await db.user.count();
    const originalTickets = await db.ticket.count();
    applyLab4();
    rollbackBeforeUse();
    expect(await db.user.count()).toBe(originalUsers);
    expect(await db.ticket.count()).toBe(originalTickets);
    expect(await db.$queryRaw`SELECT table_name FROM information_schema.tables WHERE table_schema=current_schema() AND table_name IN ('ActionTaken','ActionEvent')`).toEqual([]);
    applyLab4();
    expect(await db.actionTaken.count()).toBe(0);
    expect(await db.actionEvent.count()).toBe(0);

    const ticket = await db.ticket.findFirstOrThrow();
    await db.actionTaken.create({ data: { ticketId: ticket.id, clientRequestId: randomUUID(), description: "Recovery guard fixture", performedById: staff.id, assigneeId: staff.id } });
    expect(rollbackBeforeUse).toThrow();
    expect(await db.actionTaken.count()).toBe(1);
  }, 60000);
});
