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
const snapshot = async () => (await db.ticket.findUniqueOrThrow({ where: { id: ticketId }, select: { version: true } })).version;
const transition = async (status: Status, actor = 2, expectedTicketVersion?: number) => send(actor, { status, expectedTicketVersion: expectedTicketVersion ?? await snapshot() });

beforeAll(async () => {
  for (const [index, role] of (["REQUESTER", "REQUESTER", "IT_STAFF", "ADMINISTRATOR"] as const).entries()) {
    const user = await db.user.create({ data: { displayName: `Workflow ${index}`, email: `${marker}-${index}@example.test`, role, isActive: true, passwordHash: "locked", mustChangePassword: false } });
    ids.push(user.id); cookies.push(await cookieForUser(db, user.id));
  }
  categoryId = (await db.category.create({ data: { name: `Workflow ${marker}` } })).id;
  systemId = (await db.relatedSystem.create({ data: { name: `Workflow ${marker}` } })).id;
  ticketId = (await db.ticket.create({ data: { ticketNumber: `TKT-2096-${String(ids[0]).padStart(6, "0")}`, clientRequestId: randomUUID(), summary: "Final workflow", description: "Ticket workflow fixture", requestedPriority: "HIGH", itPriority: "HIGH", requesterId: ids[0], categoryId, relatedSystemId: systemId } })).id;
});
async function clearActions() {
  // Only this suite's disposable test schema: restore the audit guard after cleanup.
  await db.$executeRawUnsafe('ALTER TABLE "ActionEvent" DISABLE TRIGGER "ActionEvent_reject_update_delete"');
  try { await db.actionEvent.deleteMany({ where: { action: { ticketId } } }); }
  finally { await db.$executeRawUnsafe('ALTER TABLE "ActionEvent" ENABLE TRIGGER "ActionEvent_reject_update_delete"'); }
  await db.actionTaken.deleteMany({ where: { ticketId } });
}
beforeEach(async () => {
  await clearActions();
  await db.actionTaken.deleteMany({ where: { ticketId } });
  await db.ticket.update({ where: { id: ticketId }, data: { status: "NEW", version: 1, workflowCycle: 1, resolvedAt: null, ownerId: ids[2], lastOwnerId: null, problemAppearsResolvedAt: null, problemAppearsResolvedById: null } });
});
afterEach(() => vi.restoreAllMocks());
afterAll(async () => {
  await clearActions();
  await db.ticket.delete({ where: { id: ticketId } }); await db.session.deleteMany({ where: { userId: { in: ids } } }); await db.user.deleteMany({ where: { id: { in: ids } } });
  await db.category.delete({ where: { id: categoryId } }); await db.relatedSystem.delete({ where: { id: systemId } }); await db.$disconnect();
});

it("authorizes staff/admin and strictly validates the final status contract", async () => {
  const expectedTicketVersion = await snapshot();
  expect((await send(0, { status: "OPEN", expectedTicketVersion })).status).toBe(403);
  expect((await request(app).patch(path()).send({ status: "OPEN", expectedTicketVersion })).status).toBe(401);
  expect((await send(2, { status: "OPEN" })).body.error.code).toBe("VALIDATION_ERROR");
  expect((await send(2, { status: "OPEN", expectedTicketVersion: "yesterday" })).status).toBe(400);
  for (const expectedTicketVersion of [0, -1, 1.5, null, true]) expect((await send(2, { status: "OPEN", expectedTicketVersion })).status).toBe(400);
  expect((await send(2, { status: "OPEN", expectedUpdatedAt: "2026-09-26T10:00:00.000Z" })).status).toBe(400);
  expect((await send(2, { status: "OPEN", expectedTicketVersion, actorId: ids[2] })).status).toBe(400);
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
  if (to === "RESOLVED") await db.actionTaken.create({ data: { ticketId, createFingerprint: "f".repeat(64), recordedById: ids[2], clientRequestId: randomUUID(), description: "Completed evidence", result: "Verified result", status: "COMPLETED", performedById: ids[2], assigneeId: ids[2], completedAt: new Date() } });
  const result = await transition(to), valid = allowed[from].includes(to), terminal = to === "CLOSED" || to === "CANCELLED";
  expect(result.status).toBe(valid ? 200 : 409);
  if (!valid) expect(result.body.error.code).toBe("INVALID_STATUS_TRANSITION");
  expect(await db.ticket.findUniqueOrThrow({ where: { id: ticketId } })).toMatchObject({ status: valid ? to : from, ownerId: valid && terminal ? null : ids[2], lastOwnerId: valid && terminal ? ids[2] : null });
});

it("enforces the authoritative resolution gate for legacy zero-Action Tickets", async () => {
  await db.ticket.update({ where: { id: ticketId }, data: { status: "OPEN" } });
  const denied = await transition("RESOLVED");
  expect(denied.body.error.details).toContainEqual({ field: "actions", issue: "MISSING_COMPLETED_WORK" });
  expect(denied.status).toBe(409); expect(denied.body.error.code).toBe("RESOLUTION_GATE_NOT_MET");
  await db.actionTaken.create({ data: { ticketId, createFingerprint: "f".repeat(64), recordedById: ids[2], clientRequestId: randomUUID(), description: "Still working", result: "Preliminary", status: "IN_PROGRESS", assigneeId: ids[2] } });
  expect((await transition("RESOLVED")).body.error.code).toBe("RESOLUTION_GATE_NOT_MET");
  await db.actionTaken.create({ data: { ticketId, createFingerprint: "f".repeat(64), recordedById: ids[2], clientRequestId: randomUUID(), description: "Completed work", result: "Service restored", status: "COMPLETED", performedById: ids[2], assigneeId: ids[2], completedAt: new Date() } });
  const active = await transition("RESOLVED");
  expect(active.status).toBe(409); expect(active.body.error.details).toContainEqual({ field: "actions", issue: "ACTIVE_ACTIONS" });
  await db.actionTaken.deleteMany({ where: { ticketId, status: "IN_PROGRESS" } });
  expect((await transition("RESOLVED")).status).toBe(200);
});

it("rejects stale and concurrent workflow writes without partial ownership changes", async () => {
  const stale = await snapshot();
  await db.ticket.update({ where: { id: ticketId }, data: { itPriority: "LOW", version: { increment: 1 } } });
  const denied = await transition("CANCELLED", 2, stale);
  expect(denied.status).toBe(409); expect(denied.body.error.code).toBe("STALE_TICKET");
  expect(await db.ticket.findUniqueOrThrow({ where: { id: ticketId } })).toMatchObject({ status: "NEW", version: 2, workflowCycle: 1, resolvedAt: null, ownerId: ids[2], lastOwnerId: null });

  const expectedTicketVersion = await snapshot();
  const results = await Promise.all([send(2, { status: "OPEN", expectedTicketVersion }), send(3, { status: "CANCELLED", expectedTicketVersion })]);
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
    await db.ticket.update({ where: { id: ticketId }, data: { status, resolvedAt: new Date(), problemAppearsResolvedAt: new Date(), problemAppearsResolvedById: ids[0] } });
    expect((await transition("REOPENED")).status).toBe(200);
    expect(await db.ticket.findUniqueOrThrow({ where: { id: ticketId } })).toMatchObject({ status: "REOPENED", resolvedAt: null, problemAppearsResolvedAt: null, problemAppearsResolvedById: null });
  }
});

it("returns a safe unexpected-failure response", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
  const expectedTicketVersion = await snapshot();
  vi.spyOn(db, "$transaction").mockRejectedValueOnce(new Error("database password secret"));
  const result = await send(2, { status: "OPEN", expectedTicketVersion });
  expect(result.status).toBe(500); expect(result.body.error.code).toBe("INTERNAL_ERROR"); expect(JSON.stringify(result.body)).not.toContain("database password");
  log.mockRestore();
});

const actionFixture = (overrides: Record<string, unknown> = {}) => db.actionTaken.create({ data: {
  ticketId, clientRequestId: randomUUID(), createFingerprint: "f".repeat(64), recordedById: ids[2],
  assigneeId: ids[2], description: "Workflow evidence", ...overrides,
} });

it("requires new completed work after reopening and preserves the original resolution on close", async () => {
  await db.ticket.update({ where: { id: ticketId }, data: { status: "OPEN" } });
  const completed = await actionFixture({ status: "COMPLETED", result: "Restored", completedAt: new Date(), performedById: ids[2] });
  expect((await transition("RESOLVED")).body.version).toBe(2);
  const resolvedAt = (await db.ticket.findUniqueOrThrow({ where: { id: ticketId } })).resolvedAt;
  expect(resolvedAt).toBeInstanceOf(Date);
  expect((await transition("CLOSED")).status).toBe(200);
  expect((await db.ticket.findUniqueOrThrow({ where: { id: ticketId } })).resolvedAt).toEqual(resolvedAt);
  expect((await transition("REOPENED")).status).toBe(200);
  expect(await db.ticket.findUniqueOrThrow({ where: { id: ticketId } })).toMatchObject({ workflowCycle: 2, resolvedAt: null, version: 4 });
  expect((await transition("RESOLVED")).body.error.details).toContainEqual({ field: "actions", issue: "MISSING_COMPLETED_WORK" });
  expect(await db.actionTaken.findUniqueOrThrow({ where: { id: completed.id } })).toMatchObject({ status: "COMPLETED", workflowCycle: 1 });
  await actionFixture({ workflowCycle: 2, status: "COMPLETED", result: "New verified work", completedAt: new Date(), performedById: ids[2] });
  expect((await transition("RESOLVED")).status).toBe(200);
});

it("blocks outstanding current-cycle follow-up but excludes cancelled and earlier-cycle work", async () => {
  await db.ticket.update({ where: { id: ticketId }, data: { status: "OPEN", workflowCycle: 2 } });
  await actionFixture({ workflowCycle: 2, status: "COMPLETED", result: "Verified", completedAt: new Date(), performedById: ids[2] });
  const followUp = await actionFixture({ workflowCycle: 2, followUpRequired: true, followUpNote: "Follow up tomorrow" });
  const denied = await transition("RESOLVED");
  expect(denied.status).toBe(409);
  expect(denied.body.error.details).toEqual(expect.arrayContaining([
    { field: "actions", issue: "ACTIVE_ACTIONS" }, { field: "actions", issue: "OUTSTANDING_FOLLOW_UP" },
  ]));
  await db.actionTaken.update({ where: { id: followUp.id }, data: { status: "CANCELLED", cancelledAt: new Date(), cancelledById: ids[2], cancellationSource: "TICKET_CASCADE" } });
  await actionFixture({ workflowCycle: 1, followUpRequired: true, followUpNote: "Historical work" });
  expect((await transition("RESOLVED")).status).toBe(200);
});

it("cancels current-cycle active Actions with one parent version and immutable provenance", async () => {
  const planned = await actionFixture({ followUpRequired: true, followUpNote: "Retained history" });
  const working = await actionFixture({ status: "IN_PROGRESS" });
  const historical = await actionFixture({ workflowCycle: 2 });
  const completed = await actionFixture({ status: "COMPLETED", result: "Verified", completedAt: new Date(), performedById: ids[2] });
  const result = await transition("CANCELLED", 3);
  expect(result.status).toBe(200); expect(result.body.version).toBe(2);
  for (const action of [planned, working]) {
    const cancelled = await db.actionTaken.findUniqueOrThrow({ where: { id: action.id }, include: { events: true } });
    expect(cancelled).toMatchObject({ status: "CANCELLED", revision: 2, cancelledById: ids[3], cancellationSource: "TICKET_CASCADE" });
    expect(cancelled.updatedAt.toISOString()).toBe(result.body.updatedAt);
    expect(cancelled.cancelledAt).toEqual(cancelled.updatedAt);
    expect(cancelled.events).toEqual([expect.objectContaining({ eventType: "TICKET_CASCADE_CANCELLED", actorId: ids[3], revision: 2, createdAt: cancelled.updatedAt })]);
  }
  expect(await db.actionTaken.findUniqueOrThrow({ where: { id: planned.id } })).toMatchObject({ followUpRequired: true, followUpNote: "Retained history" });
  expect(await db.actionTaken.findUniqueOrThrow({ where: { id: historical.id } })).toMatchObject({ status: "PLANNED", revision: 1 });
  expect(await db.actionTaken.findUniqueOrThrow({ where: { id: completed.id } })).toMatchObject({ status: "COMPLETED", revision: 1 });
  expect((await transition("REOPENED")).status).toBe(200);
  const staleAction = await request(app).patch(`/api/staff/tickets/${ticketId}/actions/${planned.id}`).set("Cookie", `${cookies[2]}; toktickit_csrf=${csrf}`)
    .set("X-CSRF-Token", csrf).set("Origin", "http://localhost:5173").send({ expectedTicketVersion: await snapshot(), revision: 1, description: "Overwrite history" });
  expect(staleAction.status).toBe(409);
  expect(staleAction.body.error.code).toBe("STALE_ACTION");
  expect(await db.actionEvent.count({ where: { actionId: planned.id } })).toBe(1);
});

it.each(["owner", "it-priority"])("serializes status against a competing %s change using the shared version", async operation => {
  const version = await snapshot();
  const body = operation === "owner" ? { ownerId: ids[3] } : { itPriority: "LOW" };
  const other = request(app).patch(`/api/staff/tickets/${ticketId}/${operation}`).set("Cookie", `${cookies[3]}; toktickit_csrf=${csrf}`)
    .set("X-CSRF-Token", csrf).set("Origin", "http://localhost:5173").send({ ...body, expectedTicketVersion: version });
  const results = await Promise.all([transition("CANCELLED", 2, version), other]);
  expect(results.map(result => result.status).sort()).toEqual([200, 409]);
  expect(results.find(result => result.status === 409)!.body.error.code).toBe("STALE_TICKET");
  expect(await snapshot()).toBe(version + 1);
});

it("serializes resolution against new child work without losing the active Action", async () => {
  await db.ticket.update({ where: { id: ticketId }, data: { status: "OPEN" } });
  await actionFixture({ status: "COMPLETED", result: "Verified", completedAt: new Date(), performedById: ids[2] });
  const version = await snapshot();
  const create = request(app).post(`/api/staff/tickets/${ticketId}/actions`).set("Cookie", `${cookies[2]}; toktickit_csrf=${csrf}`)
    .set("X-CSRF-Token", csrf).set("Origin", "http://localhost:5173").send({ expectedTicketVersion: version, clientRequestId: randomUUID(), description: "New work", assigneeId: ids[2], followUpRequired: false });
  const [resolve, child] = await Promise.all([transition("RESOLVED", 3, version), create]);
  expect(Number(resolve.status === 200) + Number(child.status === 201)).toBe(1);
  const ticket = await db.ticket.findUniqueOrThrow({ where: { id: ticketId } });
  expect(ticket.version).toBe(version + 1);
  if (ticket.status === "RESOLVED") expect(await db.actionTaken.count({ where: { ticketId, status: "PLANNED" } })).toBe(0);
  else { expect(ticket.status).toBe("OPEN"); expect(resolve.body.error.code).toBe("STALE_TICKET"); }
});

it.each(["create", "edit", "complete"] as const)("serializes Ticket cancellation against Action %s with atomic provenance", async operation => {
  await db.ticket.update({ where: { id: ticketId }, data: { status: "OPEN" } });
  const action = await actionFixture({ status: operation === "complete" ? "IN_PROGRESS" : "PLANNED", result: "Verified result" });
  const expectedTicketVersion = await snapshot();
  const route = `/api/staff/tickets/${ticketId}/actions${operation === "create" ? "" : `/${action.id}${operation === "complete" ? "/status" : ""}`}`;
  const body = operation === "create" ? { expectedTicketVersion, clientRequestId: randomUUID(), description: "New concurrent work", assigneeId: ids[2], followUpRequired: false }
    : operation === "edit" ? { expectedTicketVersion, revision: 1, description: "Concurrent revised work" }
    : { expectedTicketVersion, revision: 1, status: "COMPLETED" };
  const child = (operation === "create" ? request(app).post(route) : request(app).patch(route))
    .set("Cookie", `${cookies[2]}; toktickit_csrf=${csrf}`).set("X-CSRF-Token", csrf).set("Origin", "http://localhost:5173").send(body);
  const [cancel, mutation] = await Promise.all([transition("CANCELLED", 3, expectedTicketVersion), child]);
  expect(Number(cancel.status === 200) + Number(mutation.status < 300)).toBe(1);
  expect([cancel.status, mutation.status].filter(status => status === 409)).toHaveLength(1);
  const ticket = await db.ticket.findUniqueOrThrow({ where: { id: ticketId } });
  expect(ticket.version).toBe(expectedTicketVersion + 1);
  const persisted = await db.actionTaken.findUniqueOrThrow({ where: { id: action.id } });
  const events = await db.actionEvent.findMany({ where: { actionId: action.id } });
  if (cancel.status === 200) {
    expect(ticket).toMatchObject({ status: "CANCELLED", ownerId: null, lastOwnerId: ids[2] });
    expect(persisted).toMatchObject({ status: "CANCELLED", revision: 2, cancellationSource: "TICKET_CASCADE", cancelledById: ids[3] });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ eventType: "TICKET_CASCADE_CANCELLED", revision: 2, actorId: ids[3], createdAt: persisted.cancelledAt });
    expect(await db.actionTaken.count({ where: { ticketId } })).toBe(1);
  } else {
    expect(cancel.body.error.code).toBe("STALE_TICKET");
    expect(ticket).toMatchObject({ status: "OPEN", ownerId: ids[2] });
    expect(persisted.cancellationSource).toBeNull();
    expect(await db.actionTaken.count({ where: { ticketId } })).toBe(operation === "create" ? 2 : 1);
    if (operation !== "create") {
      expect(persisted.revision).toBe(2);
      expect(events).toHaveLength(1);
      expect(events[0].actorId).toBe(ids[2]);
    }
  }
});
