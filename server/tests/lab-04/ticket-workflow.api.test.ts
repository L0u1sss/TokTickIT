import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { PrismaClient, Status } from "@prisma/client";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { cookieForUser } from "../session-fixture.js";

const db = new PrismaClient();
vi.mock("../../src/prisma.js", () => ({ getPrisma: () => db }));
import { app } from "../../src/app.js";

const marker = randomUUID(), csrf = "w".repeat(43), ids: number[] = [], cookies: string[] = [];
let ticketId: number, categoryId: number, systemId: number;
const path = () => `/api/staff/tickets/${ticketId}/status`;
const send = (actor: number, body: object) => request(app).patch(path()).set("Cookie", `${cookies[actor]}; toktickit_csrf=${csrf}`)
  .set("X-CSRF-Token", csrf).set("Origin", "http://localhost:5173").send(body);
const snapshot = async () => (await db.ticket.findUniqueOrThrow({ where: { id: ticketId }, select: { updatedAt: true } })).updatedAt.toISOString();
const transition = async (status: Status, actor = 2, expectedUpdatedAt?: string) => send(actor, { status, expectedUpdatedAt: expectedUpdatedAt ?? await snapshot() });

beforeAll(async () => {
  for (const [index, role] of (["REQUESTER", "REQUESTER", "IT_STAFF", "ADMINISTRATOR"] as const).entries()) {
    const user = await db.user.create({ data: { displayName: `Workflow ${index}`, email: `${marker}-${index}@example.test`, role, isActive: true, passwordHash: "locked", mustChangePassword: false } });
    ids.push(user.id); cookies.push(await cookieForUser(db, user.id));
  }
  categoryId = (await db.category.create({ data: { name: `Workflow ${marker}` } })).id;
  systemId = (await db.relatedSystem.create({ data: { name: `Workflow ${marker}` } })).id;
  ticketId = (await db.ticket.create({ data: { ticketNumber: `TKT-2096-${String(ids[0]).padStart(6, "0")}`, clientRequestId: randomUUID(), summary: "Final workflow", description: "Ticket workflow fixture", requestedPriority: "HIGH", itPriority: "HIGH", requesterId: ids[0], categoryId, relatedSystemId: systemId } })).id;
});
beforeEach(async () => {
  await db.actionEvent.deleteMany({ where: { action: { ticketId } } });
  await db.actionTaken.deleteMany({ where: { ticketId } });
  await db.ticket.update({ where: { id: ticketId }, data: { status: "NEW", ownerId: ids[2], lastOwnerId: null, problemAppearsResolvedAt: null, problemAppearsResolvedById: null } });
});
afterEach(() => vi.restoreAllMocks());
afterAll(async () => {
  await db.actionEvent.deleteMany({ where: { action: { ticketId } } }); await db.actionTaken.deleteMany({ where: { ticketId } });
  await db.ticket.delete({ where: { id: ticketId } }); await db.session.deleteMany({ where: { userId: { in: ids } } }); await db.user.deleteMany({ where: { id: { in: ids } } });
  await db.category.delete({ where: { id: categoryId } }); await db.relatedSystem.delete({ where: { id: systemId } }); await db.$disconnect();
});

it("authorizes staff/admin and strictly validates the final status contract", async () => {
  const expectedUpdatedAt = await snapshot();
  expect((await send(0, { status: "OPEN", expectedUpdatedAt })).status).toBe(403);
  expect((await request(app).patch(path()).send({ status: "OPEN", expectedUpdatedAt })).status).toBe(401);
  expect((await send(2, { status: "OPEN" })).body.error.code).toBe("VALIDATION_ERROR");
  expect((await send(2, { status: "OPEN", expectedUpdatedAt: "yesterday" })).status).toBe(400);
  expect((await send(2, { status: "OPEN", expectedUpdatedAt: "2026-02-30T10:00:00.000Z" })).status).toBe(400);
  expect((await send(2, { status: "OPEN", expectedUpdatedAt, actorId: ids[2] })).status).toBe(400);
  expect((await transition("OPEN", 3)).status).toBe(200);
});

const allowed: Record<Status, Status[]> = {
  NEW: ["OPEN", "CANCELLED"], OPEN: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  IN_PROGRESS: ["WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"], WAITING_FOR_REQUESTER: ["IN_PROGRESS", "RESOLVED", "CANCELLED"],
  RESOLVED: ["REOPENED", "CLOSED"], REOPENED: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  CLOSED: ["REOPENED"], CANCELLED: ["REOPENED"],
};
it.each(Object.values(Status).flatMap(from => Object.values(Status).map(to => [from, to] as const)))("enforces final matrix %s -> %s", async (from, to) => {
  await db.ticket.update({ where: { id: ticketId }, data: { status: from, ownerId: ids[2], lastOwnerId: null } });
  if (to === "RESOLVED") await db.actionTaken.create({ data: { ticketId, clientRequestId: randomUUID(), description: "Completed evidence", result: "Verified result", status: "COMPLETED", performedById: ids[2], assigneeId: ids[2], completedAt: new Date() } });
  const result = await transition(to), valid = allowed[from].includes(to), terminal = to === "CLOSED" || to === "CANCELLED";
  expect(result.status).toBe(valid ? 200 : 409);
  if (!valid) expect(result.body.error.code).toBe("INVALID_STATUS_TRANSITION");
  expect(await db.ticket.findUniqueOrThrow({ where: { id: ticketId } })).toMatchObject({ status: valid ? to : from, ownerId: valid && terminal ? null : ids[2], lastOwnerId: valid && terminal ? ids[2] : null });
});

it("enforces the authoritative resolution gate for legacy zero-Action Tickets", async () => {
  await db.ticket.update({ where: { id: ticketId }, data: { status: "OPEN" } });
  const denied = await transition("RESOLVED");
  expect(denied.status).toBe(409); expect(denied.body.error.code).toBe("RESOLUTION_GATE_NOT_MET");
  await db.actionTaken.create({ data: { ticketId, clientRequestId: randomUUID(), description: "Still working", result: "Preliminary", status: "IN_PROGRESS", performedById: ids[2], assigneeId: ids[2] } });
  expect((await transition("RESOLVED")).body.error.code).toBe("RESOLUTION_GATE_NOT_MET");
  await db.actionTaken.create({ data: { ticketId, clientRequestId: randomUUID(), description: "Completed work", result: "Service restored", status: "COMPLETED", performedById: ids[2], assigneeId: ids[2], completedAt: new Date() } });
  expect((await transition("RESOLVED")).status).toBe(200);
});

it("rejects stale and concurrent workflow writes without partial ownership changes", async () => {
  const stale = await snapshot();
  await db.ticket.update({ where: { id: ticketId }, data: { itPriority: "LOW", updatedAt: new Date(Date.now() + 1000) } });
  const denied = await transition("CANCELLED", 2, stale);
  expect(denied.status).toBe(409); expect(denied.body.error.code).toBe("STALE_TICKET");
  expect(await db.ticket.findUniqueOrThrow({ where: { id: ticketId } })).toMatchObject({ status: "NEW", ownerId: ids[2], lastOwnerId: null });

  const expectedUpdatedAt = await snapshot();
  const results = await Promise.all([send(2, { status: "OPEN", expectedUpdatedAt }), send(3, { status: "CANCELLED", expectedUpdatedAt })]);
  expect(results.map(result => result.status).sort()).toEqual([200, 409]);
  expect(results.find(result => result.status === 409)!.body.error.code).toBe("STALE_TICKET");
});

it("keeps Requester Problem Appears Resolved advisory only", async () => {
  const advisory = await request(app).post(`/api/tickets/${ticketId}/problem-appears-resolved`).set("Cookie", `${cookies[0]}; toktickit_csrf=${csrf}`)
    .set("X-CSRF-Token", csrf).set("Origin", "http://localhost:5173").send({});
  expect(advisory.status).toBe(200);
  expect(await db.ticket.findUniqueOrThrow({ where: { id: ticketId } })).toMatchObject({ status: "NEW", problemAppearsResolvedById: ids[0] });
  await transition("OPEN");
  expect((await transition("RESOLVED")).body.error.code).toBe("RESOLUTION_GATE_NOT_MET");
});

it("clears advisory state when reopening resolved, closed or cancelled work", async () => {
  for (const status of ["RESOLVED", "CLOSED", "CANCELLED"] as const) {
    await db.ticket.update({ where: { id: ticketId }, data: { status, problemAppearsResolvedAt: new Date(), problemAppearsResolvedById: ids[0] } });
    expect((await transition("REOPENED")).status).toBe(200);
    expect(await db.ticket.findUniqueOrThrow({ where: { id: ticketId } })).toMatchObject({ status: "REOPENED", problemAppearsResolvedAt: null, problemAppearsResolvedById: null });
  }
});

it("returns a safe unexpected-failure response", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
  const expectedUpdatedAt = await snapshot();
  vi.spyOn(db, "$transaction").mockRejectedValueOnce(new Error("database password secret"));
  const result = await send(2, { status: "OPEN", expectedUpdatedAt });
  expect(result.status).toBe(500); expect(result.body.error.code).toBe("INTERNAL_ERROR"); expect(JSON.stringify(result.body)).not.toContain("database password");
  expect(log).toHaveBeenCalled();
});
