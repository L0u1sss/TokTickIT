import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { cookieForUser } from "../session-fixture.js";

const db = new PrismaClient();
vi.mock("../../src/prisma.js", () => ({ getPrisma: () => db }));
import { app } from "../../src/app.js";

const marker = randomUUID(), csrf = "m".repeat(43);
const ids: number[] = [], cookies: string[] = [];
let ticketId: number, categoryId: number, systemId: number;
const write = (operation: string, body: object, actor = 1) => {
  const path = `/api/staff/tickets/${ticketId}/${operation}`;
  return (operation === "claim" ? request(app).post(path) : request(app).patch(path))
    .set("Cookie", `${cookies[actor]}; toktickit_csrf=${csrf}`)
    .set("X-CSRF-Token", csrf).set("Origin", "http://localhost:5173").send(body);
};
const snapshot = () => db.ticket.findUniqueOrThrow({ where: { id: ticketId } });

beforeAll(async () => {
  for (const [index, role] of (["REQUESTER", "IT_STAFF", "ADMINISTRATOR"] as const).entries()) {
    const user = await db.user.create({ data: { displayName: `Mutation ${index}`, email: `${marker}-${index}@example.test`, role, passwordHash: "locked", mustChangePassword: false } });
    ids.push(user.id); cookies.push(await cookieForUser(db, user.id));
  }
  categoryId = (await db.category.create({ data: { name: `Mutation ${marker}` } })).id;
  systemId = (await db.relatedSystem.create({ data: { name: `Mutation ${marker}` } })).id;
  ticketId = (await db.ticket.create({ data: { ticketNumber: `TKT-2095-${String(ids[0]).padStart(6, "0")}`, clientRequestId: randomUUID(), summary: "Concurrent staff operations", description: "Shared aggregate version", requesterId: ids[0], categoryId, relatedSystemId: systemId, requestedPriority: "MEDIUM", itPriority: "MEDIUM" } })).id;
});
beforeEach(async () => {
  await db.ticket.update({ where: { id: ticketId }, data: { version: 1, status: "NEW", ownerId: null, lastOwnerId: null, itPriority: "MEDIUM" } });
});
afterAll(async () => {
  await db.ticket.delete({ where: { id: ticketId } });
  await db.session.deleteMany({ where: { userId: { in: ids } } });
  await db.user.deleteMany({ where: { id: { in: ids } } });
  await db.category.delete({ where: { id: categoryId } });
  await db.relatedSystem.delete({ where: { id: systemId } });
  await db.$disconnect();
});

const operations = ["claim", "owner", "it-priority"] as const;
const bodyFor = (operation: typeof operations[number], actor = 1) => operation === "owner" ? { ownerId: ids[actor] } : operation === "it-priority" ? { itPriority: actor === 1 ? "LOW" : "HIGH" } : {};

it.each(operations)("%s rejects missing, malformed and stale versions without changing the aggregate", async operation => {
  const before = await snapshot();
  for (const expectedTicketVersion of [undefined, 0, -1, 1.5, "1", null]) {
    expect((await write(operation, { ...bodyFor(operation), expectedTicketVersion })).status).toBe(400);
  }
  const denied = await write(operation, { ...bodyFor(operation), expectedTicketVersion: 2 });
  expect(denied.status).toBe(409);
  expect(denied.body.error.code).toBe("STALE_TICKET");
  expect(await snapshot()).toEqual(before);
});

it.each(operations)("%s uses the authenticated staff/admin role and rejects requester writes", async operation => {
  const before = await snapshot();
  expect((await write(operation, { ...bodyFor(operation), expectedTicketVersion: 1 }, 0)).status).toBe(403);
  expect(await snapshot()).toEqual(before);
  const accepted = await write(operation, { ...bodyFor(operation, 2), expectedTicketVersion: 1 }, 2);
  expect(accepted.status).toBe(200);
  expect(accepted.body.version).toBe(2);
});

it.each(operations)("competing %s writes accept one winner and persist its response", async operation => {
  const results = await Promise.all([1, 2].map(actor => write(operation, { ...bodyFor(operation, actor), expectedTicketVersion: 1 }, actor)));
  expect(results.map(result => result.status).sort()).toEqual([200, 409]);
  const winner = results.find(result => result.status === 200)!;
  expect(results.find(result => result.status === 409)!.body.error.code).toBe("STALE_TICKET");
  expect(winner.body.version).toBe(2);
  expect(await snapshot()).toMatchObject({ version: 2, requestedPriority: "MEDIUM",
    ownerId: operation === "it-priority" ? null : winner.body.owner.id,
    itPriority: operation === "it-priority" ? winner.body.itPriority : "MEDIUM",
  });
});

it("owner and priority writes share one version; retry with the next token preserves both changes", async () => {
  const results = await Promise.all([
    write("owner", { ownerId: ids[1], expectedTicketVersion: 1 }),
    write("it-priority", { itPriority: "HIGH", expectedTicketVersion: 1 }, 2),
  ]);
  expect(results.map(result => result.status).sort()).toEqual([200, 409]);
  const winner = results.findIndex(result => result.status === 200);
  expect(results[1 - winner].body.error.code).toBe("STALE_TICKET");
  expect(await snapshot()).toMatchObject({ version: 2, ownerId: winner === 0 ? ids[1] : null, itPriority: winner === 1 ? "HIGH" : "MEDIUM" });
  const retry = winner === 0
    ? await write("it-priority", { itPriority: "HIGH", expectedTicketVersion: 2 }, 2)
    : await write("owner", { ownerId: ids[1], expectedTicketVersion: 2 });
  expect(retry.status).toBe(200);
  expect(retry.body.version).toBe(3);
  expect(await snapshot()).toMatchObject({ version: 3, ownerId: ids[1], itPriority: "HIGH", requestedPriority: "MEDIUM" });
});
