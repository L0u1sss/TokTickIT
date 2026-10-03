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

async function createLegacyTicket(db: PrismaClient, references: Awaited<ReturnType<typeof seedLab3References>>, ticketNumber: string) {
  const now = new Date();
  const [ticket] = await db.$queryRaw<Array<{ id: number }>>`
    INSERT INTO "Ticket" (
      "ticketNumber", "clientRequestId", "summary", "description", "requestedPriority", "itPriority",
      "status", "requesterId", "ownerId", "categoryId", "relatedSystemId", "updatedAt"
    ) VALUES (
      ${ticketNumber}, ${randomUUID()}::uuid, 'Legacy Lab 3 Ticket', 'All existing data and relationships must survive.',
      'HIGH'::"Priority", 'MEDIUM'::"Priority", 'IN_PROGRESS'::"Status", ${references.requester.id},
      ${references.staff.id}, ${references.category.id}, ${references.system.id}, ${now}
    ) RETURNING "id"
  `;
  return ticket;
}

async function legacyTicketRows(db: PrismaClient) {
  return db.$queryRaw`
    SELECT "id", "ticketNumber", "clientRequestId", "summary", "description", "requestedPriority", "itPriority",
      "ownerId", "lastOwnerId", "problemAppearsResolvedAt", "problemAppearsResolvedById", "status", "requesterId",
      "categoryId", "relatedSystemId", "createdAt", "updatedAt"
    FROM "Ticket" ORDER BY "id" ASC
  `;
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
    const references = await seedLab3References(db);
    const ticket = await createLegacyTicket(db, references, "TKT-2099-000001");
    const attachment = await db.attachment.create({ data: { ticketId: ticket.id, originalName: "legacy.pdf", storageKey: randomUUID(), sizeBytes: 12, mimeType: "application/pdf", uploadedByRequesterId: references.requester.id } });
    const comment = await db.publicComment.create({ data: { ticketId: ticket.id, authorId: references.requester.id, content: "Existing public comment" } });
    const note = await db.internalNote.create({ data: { ticketId: ticket.id, authorId: references.staff.id, content: "Existing internal note" } });
    const before = {
      users: await db.user.findMany({ orderBy: { id: "asc" } }),
      tickets: await legacyTicketRows(db),
      attachments: await db.attachment.findMany({ orderBy: { id: "asc" } }),
      comments: await db.publicComment.findMany({ orderBy: { id: "asc" } }),
      notes: await db.internalNote.findMany({ orderBy: { id: "asc" } }),
    };

    applyLab4();

    expect(await db.user.findMany({ orderBy: { id: "asc" } })).toEqual(before.users);
    expect(await legacyTicketRows(db)).toEqual(before.tickets);
    expect(await db.ticket.findUniqueOrThrow({ where: { id: ticket.id } })).toMatchObject({ version: 1, workflowCycle: 1, resolvedAt: null });
    expect(await db.attachment.findMany({ orderBy: { id: "asc" } })).toEqual(before.attachments);
    expect(await db.publicComment.findMany({ orderBy: { id: "asc" } })).toEqual(before.comments);
    expect(await db.internalNote.findMany({ orderBy: { id: "asc" } })).toEqual(before.notes);
    expect(await db.actionTaken.count()).toBe(0);
    expect(await db.actionEvent.count()).toBe(0);
    expect(await db.$queryRaw<Array<{ enumlabel: string }>>`
      SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'ActionEventType' AND t.typnamespace = current_schema()::regnamespace
      ORDER BY e.enumsortorder
    `).toEqual([
      { enumlabel: "ACTION_CREATED" },
      { enumlabel: "ACTION_UPDATED" },
      { enumlabel: "ACTION_COMPLETED" },
      { enumlabel: "ACTION_CANCELLED" },
      { enumlabel: "TICKET_CASCADE_CANCELLED" },
    ]);
    await expect(db.ticket.delete({ where: { id: ticket.id } })).rejects.toThrow();
    expect(await db.attachment.findUnique({ where: { id: attachment.id } })).toEqual(attachment);
    expect(await db.publicComment.findUnique({ where: { id: comment.id } })).toEqual(comment);
    expect(await db.internalNote.findUnique({ where: { id: note.id } })).toEqual(note);
    await seedDatabase(db);
    await seedDatabase(db);
    expect(await db.user.findMany({ where: { id: { in: [references.requester.id, references.staff.id] } }, orderBy: { id: "asc" } })).toEqual(before.users);
    expect((await legacyTicketRows(db) as Array<{ id: number }>).filter(row => row.id === ticket.id)).toEqual(before.tickets);
    expect(await db.ticket.findUniqueOrThrow({ where: { id: ticket.id } })).toMatchObject({ version: 1, workflowCycle: 1, resolvedAt: null });
    expect(await db.actionTaken.count({ where: { ticketId: ticket.id } })).toBe(0);
    expect(await db.attachment.findUnique({ where: { id: attachment.id } })).toEqual(attachment);
    expect(await db.publicComment.findUnique({ where: { id: comment.id } })).toEqual(comment);
    expect(await db.internalNote.findUnique({ where: { id: note.id } })).toEqual(note);
  }, 60000);

  it("supports fresh deployment and repeated seed without overwriting seeded records", async () => {
    const { db } = await disposableDatabase(true);
    await seedDatabase(db);
    expect(await db.ticket.count({ where: { ticketNumber: { startsWith: "TKT-2026-9" } } })).toBe(8);
    expect(await db.actionTaken.count()).toBe(6);
    expect(await db.actionEvent.count()).toBe(14);
    const audited = await db.actionTaken.findFirstOrThrow({
      where: { description: "Run hardware diagnostics after driver installation." },
      include: { recordedBy: true, performedBy: true, assignee: true, events: { include: { actor: true }, orderBy: { revision: "asc" } } },
    });
    expect(audited).toMatchObject({ status: "COMPLETED", workflowCycle: 1, revision: 3 });
    expect(audited.performedBy).not.toBeNull();
    expect(audited.performedBy!.id).toBe(audited.assignee.id);
    expect(audited.recordedBy.id).not.toBe(audited.assignee.id);
    expect(audited.events).toHaveLength(3);
    expect(audited.events[0]).toMatchObject({ eventType: "ACTION_CREATED", revision: 1, actorId: audited.recordedById });
    expect(audited.events[2]).toMatchObject({ eventType: "ACTION_COMPLETED", revision: 3, actorId: audited.performedById });
    expect(audited.events[0].createdAt).toEqual(audited.createdAt);
    expect(audited.events[2].createdAt).toEqual(audited.completedAt);
    const planned = await db.actionTaken.findFirstOrThrow({ where: { status: "PLANNED" } });
    expect(planned.performedById).toBeNull();
    expect(planned.workflowCycle).toBe(1);
    const cancelled = await db.actionTaken.findFirstOrThrow({ where: { status: "CANCELLED", cancellationSource: "STAFF_ACTION" } });
    expect(cancelled).toMatchObject({
      cancelledAt: expect.any(Date),
      cancelledById: expect.any(Number),
      cancellationSource: "STAFF_ACTION",
      performedById: null,
    });
    const staffCancellationEvent = await db.actionEvent.findFirstOrThrow({ where: { actionId: cancelled.id, eventType: "ACTION_CANCELLED" } });
    expect(staffCancellationEvent).toMatchObject({ actorId: cancelled.cancelledById, createdAt: cancelled.cancelledAt });
    const cascadeCancelled = await db.actionTaken.findFirstOrThrow({
      where: { cancellationSource: "TICKET_CASCADE" },
      include: { events: { orderBy: { revision: "asc" } } },
    });
    expect(cascadeCancelled).toMatchObject({
      status: "CANCELLED",
      followUpRequired: true,
      followUpNote: "Retain the requester confirmation with the cancelled request.",
      cancellationSource: "TICKET_CASCADE",
      cancelledById: expect.any(Number),
    });
    expect(cascadeCancelled.events.at(-1)).toMatchObject({
      eventType: "TICKET_CASCADE_CANCELLED",
      actorId: cascadeCancelled.cancelledById,
      createdAt: cascadeCancelled.cancelledAt,
    });
    const reopened = await db.ticket.findFirstOrThrow({ where: { status: "REOPENED" } });
    expect(reopened).toMatchObject({ version: 1, workflowCycle: 2, resolvedAt: null });
    const resolved = await db.ticket.findFirstOrThrow({ where: { status: "RESOLVED" } });
    expect(resolved.resolvedAt).toBeInstanceOf(Date);

    const cameraActions = await db.actionTaken.findMany({ where: { ticketId: audited.ticketId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
    await db.actionTaken.update({ where: { id: cameraActions[0].id }, data: { createdAt: new Date("2026-09-25T02:00:00.000Z") } });
    await db.actionTaken.update({ where: { id: cameraActions[1].id }, data: { createdAt: new Date("2026-09-24T02:00:00.000Z") } });
    const chronological = await db.actionTaken.findMany({ where: { ticketId: audited.ticketId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
    expect(chronological.map(action => action.id)).toEqual([cameraActions[1].id, cameraActions[0].id]);
    const tiedAt = new Date("2026-09-26T02:00:00.000Z");
    await db.actionTaken.updateMany({ where: { ticketId: audited.ticketId }, data: { createdAt: tiedAt } });
    const tied = await db.actionTaken.findMany({ where: { ticketId: audited.ticketId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
    expect(tied.map(action => action.id)).toEqual(cameraActions.map(action => action.id).sort((left, right) => left - right));
    await expect(db.actionTaken.create({ data: {
      ticketId: audited.ticketId, clientRequestId: randomUUID(), description: "Missing conditional note",
      createFingerprint: "1".repeat(64),
      recordedById: audited.recordedById, assigneeId: audited.assigneeId, followUpRequired: true,
    } })).rejects.toThrow();
    await expect(db.actionTaken.create({ data: {
      ticketId: audited.ticketId, clientRequestId: randomUUID(), description: "Invalid completion",
      createFingerprint: "2".repeat(64),
      recordedById: audited.recordedById, assigneeId: audited.assigneeId, status: "COMPLETED",
      result: "Completed without performer", completedAt: new Date(),
    } })).rejects.toThrow();
    await expect(db.actionTaken.create({ data: {
      ticketId: audited.ticketId, clientRequestId: randomUUID(), description: "Active Action with completion provenance",
      createFingerprint: "3".repeat(64),
      recordedById: audited.recordedById, performedById: audited.assigneeId, assigneeId: audited.assigneeId, status: "IN_PROGRESS",
    } })).rejects.toThrow();
    await expect(db.actionTaken.create({ data: {
      ticketId: audited.ticketId, clientRequestId: randomUUID(), description: "Cancelled without provenance",
      createFingerprint: "4".repeat(64),
      recordedById: audited.recordedById, assigneeId: audited.assigneeId, status: "CANCELLED",
    } })).rejects.toThrow();
    const invalidEvent = {
      actionId: audited.id,
      actorId: audited.recordedById,
      eventType: "ACTION_UPDATED" as const,
      fromStatus: "PLANNED" as const,
      toStatus: "IN_PROGRESS" as const,
      revision: 99,
    };
    await expect(db.actionEvent.create({ data: { ...invalidEvent, changedFields: {} } })).rejects.toThrow();
    await expect(db.actionEvent.create({ data: { ...invalidEvent, changedFields: { fields: [] } } })).rejects.toThrow();
    await expect(db.actionEvent.create({ data: { ...invalidEvent, changedFields: { fields: [""] } } })).rejects.toThrow();
    await expect(db.actionEvent.create({ data: { ...invalidEvent, changedFields: { fields: [1] } } })).rejects.toThrow();
    await expect(db.actionEvent.create({ data: { ...invalidEvent, changedFields: { fields: ["status"], extra: true } } })).rejects.toThrow();
    const immutableEvent = await db.actionEvent.findFirstOrThrow({ where: { actionId: audited.id } });
    await expect(db.actionEvent.update({ where: { id: immutableEvent.id }, data: { changedFields: { fields: ["status"] } } })).rejects.toThrow();
    await expect(db.actionEvent.delete({ where: { id: immutableEvent.id } })).rejects.toThrow();
    await expect(db.$executeRawUnsafe('TRUNCATE TABLE "ActionEvent"')).rejects.toThrow();
    await expect(db.actionTaken.create({ data: {
      ticketId: audited.ticketId, clientRequestId: audited.clientRequestId, description: "Duplicate retry identity",
      createFingerprint: "5".repeat(64),
      recordedById: audited.recordedById, assigneeId: audited.assigneeId,
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
    // This deliberate out-of-band edit tests seed preservation; its revision/event chain is not a valid API-write fixture.
    await db.actionTaken.update({ where: { id: changedAction.id }, data: { description: "Locally reviewed description", revision: 2 } });
    const changedTicket = await db.ticket.findFirstOrThrow({ where: { ticketNumber: "TKT-2026-900001" } });
    await db.ticket.update({ where: { id: changedTicket.id }, data: { summary: "Locally reviewed summary" } });
    await seedDatabase(db);
    expect(await db.actionTaken.count()).toBe(6);
    expect(await db.actionEvent.count()).toBe(14);
    expect(await db.actionTaken.findUniqueOrThrow({ where: { id: changedAction.id } })).toMatchObject({ description: "Locally reviewed description", revision: 2 });
    expect(await db.ticket.findUniqueOrThrow({ where: { id: changedTicket.id } })).toMatchObject({ summary: "Locally reviewed summary" });
  }, 60000);

  it("tests guarded pre-use rollback and forward recovery without touching Lab 3 data", async () => {
    const { db, applyLab4, rollbackBeforeUse } = await disposableDatabase(false);
    const references = await seedLab3References(db);
    const legacy = await createLegacyTicket(db, references, "TKT-2099-000002");
    await db.attachment.create({ data: { ticketId: legacy.id, originalName: "recovery.pdf", storageKey: randomUUID(), sizeBytes: 12, mimeType: "application/pdf", uploadedByRequesterId: references.requester.id } });
    await db.publicComment.create({ data: { ticketId: legacy.id, authorId: references.requester.id, content: "Recovery public comment" } });
    await db.internalNote.create({ data: { ticketId: legacy.id, authorId: references.staff.id, content: "Recovery internal note" } });
    const legacySnapshot = async () => ({ users: await db.user.findMany({ orderBy: { id: "asc" } }), tickets: await legacyTicketRows(db), attachments: await db.attachment.findMany(), comments: await db.publicComment.findMany(), notes: await db.internalNote.findMany() });
    const before = await legacySnapshot();
    const originalUsers = await db.user.count();
    const originalTickets = await db.ticket.count();
    applyLab4();
    rollbackBeforeUse();
    expect(await db.user.count()).toBe(originalUsers);
    expect(await db.ticket.count()).toBe(originalTickets);
    expect(await legacySnapshot()).toEqual(before);
    expect(await db.$queryRaw`SELECT table_name FROM information_schema.tables WHERE table_schema=current_schema() AND table_name IN ('ActionTaken','ActionEvent')`).toEqual([]);
    applyLab4();
    expect(await db.actionTaken.count()).toBe(0);
    expect(await db.actionEvent.count()).toBe(0);
    expect(await legacySnapshot()).toEqual(before);

    const ticket = await db.ticket.findFirstOrThrow();
    await db.actionTaken.create({ data: { ticketId: ticket.id, clientRequestId: randomUUID(), createFingerprint: "6".repeat(64), description: "Recovery guard fixture", recordedById: references.staff.id, assigneeId: references.staff.id } });
    expect(rollbackBeforeUse).toThrow();
    expect(await db.actionTaken.count()).toBe(1);
  }, 60000);
});
