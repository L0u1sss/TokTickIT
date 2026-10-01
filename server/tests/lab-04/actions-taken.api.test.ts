import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { cookieForUser } from "../session-fixture.js";

const db = new PrismaClient();
vi.mock("../../src/prisma.js", () => ({ getPrisma: () => db }));
import { app } from "../../src/app.js";

const marker = randomUUID();
const csrf = "l".repeat(43);
const userIds: number[] = [];
const cookies: string[] = [];
let categoryId: number;
let systemId: number;
let ownedTicketId: number;
let otherTicketId: number;

const staffPath = (suffix = "", ticketId = ownedTicketId) => `/api/staff/tickets/${ticketId}/actions${suffix}`;
const requesterPath = (suffix = "", ticketId = ownedTicketId) => `/api/tickets/${ticketId}/actions${suffix}`;
const staffRead = (suffix = "", actor = 2, ticketId = ownedTicketId) => request(app).get(staffPath(suffix, ticketId)).set("Cookie", cookies[actor]);
const requesterRead = (suffix = "", actor = 0, ticketId = ownedTicketId) => request(app).get(requesterPath(suffix, ticketId)).set("Cookie", cookies[actor]);
const staffWrite = (method: "post" | "patch", suffix: string, body: object, actor = 2, ticketId = ownedTicketId) => request(app)[method](staffPath(suffix, ticketId))
  .set("Cookie", `${cookies[actor]}; toktickit_csrf=${csrf}`)
  .set("X-CSRF-Token", csrf)
  .set("Origin", "http://localhost:5173")
  .send(body);

function createBody(overrides: Record<string, unknown> = {}) {
  return {
    clientRequestId: randomUUID(),
    expectedTicketVersion: 1,
    description: "Inspect the affected device and record the work.",
    result: null,
    assigneeId: userIds[3],
    followUpRequired: false,
    followUpNote: null,
    attachmentNotes: "See the diagnostic image attached to the Ticket.",
    ...overrides,
  };
}

async function createAction(overrides: Record<string, unknown> = {}, actor = 2) {
  return staffWrite("post", "", createBody(overrides), actor);
}

beforeAll(async () => {
  for (const [index, role] of (["REQUESTER", "REQUESTER", "IT_STAFF", "IT_STAFF", "ADMINISTRATOR", "IT_STAFF"] as const).entries()) {
    const user = await db.user.create({
      data: {
        displayName: `Action API ${index}`,
        email: `${marker}-${index}@example.test`,
        role,
        isActive: index !== 5,
        passwordHash: "locked",
        mustChangePassword: false,
      },
    });
    userIds.push(user.id);
    cookies.push(await cookieForUser(db, user.id));
  }
  categoryId = (await db.category.create({ data: { name: `Action API ${marker}` } })).id;
  systemId = (await db.relatedSystem.create({ data: { name: `Action API ${marker}` } })).id;
  ownedTicketId = (await db.ticket.create({ data: {
    ticketNumber: `TKT-2093-${String(userIds[0]).padStart(6, "0")}`,
    clientRequestId: randomUUID(), summary: "Actions API owned Ticket", description: "Requester-owned Action visibility fixture.",
    requestedPriority: "HIGH", itPriority: "HIGH", requesterId: userIds[0], categoryId, relatedSystemId: systemId,
  } })).id;
  otherTicketId = (await db.ticket.create({ data: {
    ticketNumber: `TKT-2093-${String(userIds[1]).padStart(6, "0")}`,
    clientRequestId: randomUUID(), summary: "Other requester Ticket", description: "Cross-owner protection fixture.",
    requestedPriority: "LOW", itPriority: "LOW", requesterId: userIds[1], categoryId, relatedSystemId: systemId,
  } })).id;
});

beforeEach(async () => {
  // The test schema is disposable. Temporarily disable only the UPDATE/DELETE
  // guard to remove prior-test fixtures; the append-only behavior is separately
  // asserted while the trigger is enabled in migration integration tests.
  await db.$executeRawUnsafe('ALTER TABLE "ActionEvent" DISABLE TRIGGER "ActionEvent_reject_update_delete"');
  await db.actionEvent.deleteMany({ where: { action: { ticketId: { in: [ownedTicketId, otherTicketId] } } } });
  await db.$executeRawUnsafe('ALTER TABLE "ActionEvent" ENABLE TRIGGER "ActionEvent_reject_update_delete"');
  await db.actionTaken.deleteMany({ where: { ticketId: { in: [ownedTicketId, otherTicketId] } } });
  await db.ticket.updateMany({ where: { id: { in: [ownedTicketId, otherTicketId] } }, data: { status: "NEW", version: 1, workflowCycle: 1, resolvedAt: null, problemAppearsResolvedAt: null, problemAppearsResolvedById: null } });
  await db.user.update({ where: { id: userIds[3] }, data: { isActive: true, role: "IT_STAFF" } });
});

afterEach(() => vi.restoreAllMocks());

afterAll(async () => {
  // This suite runs in a disposable schema. Disable only its DELETE guard while
  // removing fixtures so other suites still see the four seeded categories.
  await db.$executeRawUnsafe('ALTER TABLE "ActionEvent" DISABLE TRIGGER "ActionEvent_reject_update_delete"');
  await db.actionEvent.deleteMany({ where: { action: { ticketId: { in: [ownedTicketId, otherTicketId] } } } });
  await db.$executeRawUnsafe('ALTER TABLE "ActionEvent" ENABLE TRIGGER "ActionEvent_reject_update_delete"');
  await db.actionTaken.deleteMany({ where: { ticketId: { in: [ownedTicketId, otherTicketId] } } });
  await db.ticket.deleteMany({ where: { id: { in: [ownedTicketId, otherTicketId] } } });
  await db.session.deleteMany({ where: { userId: { in: userIds } } });
  await db.user.deleteMany({ where: { id: { in: userIds } } });
  await db.category.delete({ where: { id: categoryId } });
  await db.relatedSystem.delete({ where: { id: systemId } });
  await db.$disconnect();
});

it("creates, retrieves and persists an Action with authoritative actor and audit identity", async () => {
  const result = await createAction({
    followUpRequired: true,
    followUpNote: "Confirm stability tomorrow.",
  });
  expect(result.status).toBe(201);
  expect(result.headers.location).toBe(`/api/staff/tickets/${ownedTicketId}/actions/${result.body.action.id}`);
  expect(result.body).toMatchObject({
    replayed: false,
    action: {
      ticketId: ownedTicketId, status: "PLANNED", revision: 1,
      recordedBy: { id: userIds[2], role: "IT_STAFF" },
      performedBy: null,
      assignee: { id: userIds[3], role: "IT_STAFF" },
      followUpRequired: true, followUpNote: "Confirm stability tomorrow.",
    },
  });
  expect(result.body.action.createdAt).toEqual(expect.any(String));
  expect(result.body.action.updatedAt).toEqual(expect.any(String));
  expect(result.body.action.completedAt).toBeNull();
  expect(result.body.ticketVersion).toBe(2);
  expect(JSON.stringify(result.body)).not.toMatch(/passwordHash|email|isActive|mustChangePassword/);

  const persisted = await db.actionTaken.findUniqueOrThrow({ where: { id: result.body.action.id }, include: { events: true } });
  expect(persisted).toMatchObject({ ticketId: ownedTicketId, recordedById: userIds[2], performedById: null, assigneeId: userIds[3], revision: 1 });
  expect(persisted.events).toEqual([expect.objectContaining({ actorId: userIds[2], eventType: "ACTION_CREATED", toStatus: "PLANNED", revision: 1 })]);
  expect((await staffRead(`/${persisted.id}`)).body).toMatchObject({ id: persisted.id, performedBy: null, recordedBy: { id: userIds[2] } });
});

it("returns stable oldest-first lists to staff and only the owning Requester", async () => {
  const first = await createAction({ description: "First Action" });
  const second = await createAction({ description: "Second Action", clientRequestId: randomUUID(), expectedTicketVersion: first.body.ticketVersion }, 4);
  await db.actionTaken.update({ where: { id: first.body.action.id }, data: { createdAt: new Date("2026-01-01T00:00:00Z") } });
  await db.actionTaken.update({ where: { id: second.body.action.id }, data: { createdAt: new Date("2026-01-02T00:00:00Z") } });
  for (const result of [await staffRead(), await requesterRead()]) {
    expect(result.status).toBe(200);
    expect(result.body.items.map((action: { id: number }) => action.id)).toEqual([first.body.action.id, second.body.action.id]);
  }
  expect((await requesterRead("", 1)).status).toBe(404);
  expect((await requesterRead("", 0, otherTicketId)).status).toBe(404);
  expect((await requesterRead(`/${first.body.action.id}`, 1)).status).toBe(404);
});

it("enforces authentication, role authorization and read-only Requester access", async () => {
  expect((await request(app).get(staffPath())).status).toBe(401);
  expect((await request(app).get(requesterPath())).status).toBe(401);
  expect((await request(app).get(staffPath()).set("Cookie", cookies[0])).status).toBe(403);
  expect((await staffWrite("post", "", createBody(), 0)).status).toBe(403);
  const requesterWrite = await request(app).post(requesterPath())
    .set("Cookie", cookies[0]).set("Origin", "http://localhost:5173").send(createBody());
  expect(requesterWrite.status).toBe(404);
  expect((await staffRead("", 5)).status).toBe(401);
});

it("rejects forged actor fields, invalid text and inconsistent follow-up data", async () => {
  for (const body of [
    createBody({ performedById: userIds[4] }),
    createBody({ status: "COMPLETED" }),
    createBody({ createdAt: new Date().toISOString() }),
    createBody({ description: " " }),
    createBody({ description: "x".repeat(2001) }),
    createBody({ result: "x".repeat(2001) }),
    createBody({ followUpRequired: true, followUpNote: null }),
    createBody({ followUpRequired: false, followUpNote: "Contradictory" }),
    createBody({ attachmentNotes: "x".repeat(1001) }),
    createBody({ clientRequestId: "not-a-uuid" }),
  ]) {
    const result = await staffWrite("post", "", body);
    expect(result.status).toBe(400);
    expect(result.body.error.code).toBe("VALIDATION_ERROR");
  }
  const boundary = await createAction({ description: "ก".repeat(2000), attachmentNotes: "ข".repeat(1000) });
  expect(boundary.status).toBe(201);
});

it("rejects inactive, Requester and missing assignees without changing data", async () => {
  for (const assigneeId of [userIds[0], userIds[5], 2147483647]) {
    const result = await createAction({ assigneeId });
    expect(result.status).toBe(409);
    expect(result.body.error.code).toBe("INVALID_ACTION_ASSIGNEE");
  }
  expect(await db.actionTaken.count({ where: { ticketId: ownedTicketId } })).toBe(0);
});

it("replays an identical create and rejects reuse with different data", async () => {
  const body = createBody();
  const first = await staffWrite("post", "", body);
  const replay = await staffWrite("post", "", { ...body, expectedTicketVersion: first.body.ticketVersion });
  expect(first.status).toBe(201);
  expect(replay.status).toBe(200);
  expect(replay.body).toMatchObject({ replayed: true, action: { id: first.body.action.id } });
  const conflict = await staffWrite("post", "", { ...body, description: "Different work" });
  expect(conflict.status).toBe(409);
  expect(conflict.body.error.code).toBe("IDEMPOTENCY_CONFLICT");
  expect(await db.actionTaken.count({ where: { ticketId: ownedTicketId } })).toBe(1);
  expect(await db.actionEvent.count({ where: { actionId: first.body.action.id } })).toBe(1);
  const concurrentBody = createBody({ expectedTicketVersion: replay.body.ticketVersion });
  const concurrent = await Promise.all([
    staffWrite("post", "", concurrentBody),
    staffWrite("post", "", concurrentBody),
  ]);
  expect(concurrent.map(result => result.status).sort()).toEqual([200, 201]);
  expect(new Set(concurrent.map(result => result.body.action.id)).size).toBe(1);
  expect(await db.actionTaken.count({ where: { ticketId: ownedTicketId } })).toBe(2);
  expect(await db.actionEvent.count({ where: { actionId: concurrent[0].body.action.id } })).toBe(1);
});

it("replays the original normalized create intent after the Action projection changes", async () => {
  const body = createBody();
  const first = await staffWrite("post", "", body);
  const edited = await staffWrite("patch", `/${first.body.action.id}`, {
    expectedTicketVersion: first.body.ticketVersion, revision: 1, description: "Edited after creation", assigneeId: userIds[4],
  });
  expect(edited.status).toBe(200);
  const replay = await staffWrite("post", "", { ...body, expectedTicketVersion: edited.body.ticketVersion });
  expect(replay.status).toBe(200);
  expect(replay.body).toMatchObject({ replayed: true, action: { id: first.body.action.id, description: "Edited after creation", assignee: { id: userIds[4] } }, ticketVersion: edited.body.ticketVersion });
  expect(await db.actionEvent.count({ where: { actionId: first.body.action.id } })).toBe(2);
});

it("races reassignment against completion and enforces the resulting current assignee", async () => {
  const created = await createAction();
  const id = created.body.action.id;
  const started = await staffWrite("patch", `/${id}/status`, { expectedTicketVersion: created.body.ticketVersion, status: "IN_PROGRESS", revision: 1 });
  expect(started.status).toBe(200);
  const [reassign, complete] = await Promise.all([
    staffWrite("patch", `/${id}`, { expectedTicketVersion: started.body.ticketVersion, revision: 2, assigneeId: userIds[4] }, 2),
    staffWrite("patch", `/${id}/status`, { expectedTicketVersion: started.body.ticketVersion, status: "COMPLETED", revision: 2, result: "Done." }, 3),
  ]);
  const winner = reassign.status === 200 ? "reassigned" : complete.status === 200 ? "completed" : "neither";
  expect(winner).not.toBe("neither");
  const current = await db.actionTaken.findUniqueOrThrow({ where: { id } });
  const ticket = await db.ticket.findUniqueOrThrow({ where: { id: ownedTicketId } });
  expect(ticket.version).toBe(started.body.ticketVersion + 1);
  if (winner === "reassigned") {
    expect(complete.status).toBe(409);
    expect(complete.body.error.code).toBe("STALE_TICKET");
    expect(current).toMatchObject({ status: "IN_PROGRESS", assigneeId: userIds[4], performedById: null });
  } else {
    expect(reassign.status).toBe(409);
    expect(reassign.body.error.code).toBe("STALE_TICKET");
    expect(current).toMatchObject({ status: "COMPLETED", assigneeId: userIds[3], performedById: userIds[3] });
  }
});

it("rejects stale parent versions on Action create, update, and transition", async () => {
  const created = await createAction();
  const id = created.body.action.id;
  const staleCreate = await createAction({ expectedTicketVersion: 1 });
  expect(staleCreate.status).toBe(409);
  expect(staleCreate.body.error.code).toBe("STALE_TICKET");
  const updatedTicket = await request(app).patch(`/api/staff/tickets/${ownedTicketId}/it-priority`)
    .set("Cookie", `${cookies[2]}; toktickit_csrf=${csrf}`).set("X-CSRF-Token", csrf)
    .set("Origin", "http://localhost:5173").send({ itPriority: "LOW", expectedTicketVersion: created.body.ticketVersion });
  expect(updatedTicket.status).toBe(200);
  const staleUpdate = await staffWrite("patch", `/${id}`, { expectedTicketVersion: created.body.ticketVersion, revision: 1, description: "stale" });
  expect(staleUpdate.status).toBe(409);
  expect(staleUpdate.body.error.code).toBe("STALE_TICKET");
  const staleTransition = await staffWrite("patch", `/${id}/status`, { expectedTicketVersion: created.body.ticketVersion, revision: 1, status: "IN_PROGRESS" });
  expect(staleTransition.status).toBe(409);
  expect(staleTransition.body.error.code).toBe("STALE_TICKET");
});

it("records staff cancellation provenance and rejects follow-up terminal transitions", async () => {
  const actionWithFollowUp = await createAction({ followUpRequired: true, followUpNote: "Check later." });
  const cancelBlocked = await staffWrite("patch", `/${actionWithFollowUp.body.action.id}/status`, {
    expectedTicketVersion: actionWithFollowUp.body.ticketVersion, revision: 1, status: "CANCELLED",
  });
  expect(cancelBlocked.status).toBe(400);
  const action = await createAction({ expectedTicketVersion: actionWithFollowUp.body.ticketVersion, followUpRequired: false, followUpNote: null });
  const cancelled = await staffWrite("patch", `/${action.body.action.id}/status`, {
    expectedTicketVersion: action.body.ticketVersion, revision: 1, status: "CANCELLED",
  });
  expect(cancelled.status).toBe(200);
  expect(cancelled.body.action).toMatchObject({ status: "CANCELLED", cancelledBy: { id: userIds[2] }, cancellationSource: "STAFF_ACTION", cancelledAt: expect.any(String) });
});

it("increments Ticket version once and appends cascade cancellation events atomically", async () => {
  const action = await createAction({ followUpRequired: true, followUpNote: "Historical follow-up" });
  const changed = await request(app).patch(`/api/staff/tickets/${ownedTicketId}/status`)
    .set("Cookie", `${cookies[2]}; toktickit_csrf=${csrf}`).set("X-CSRF-Token", csrf)
    .set("Origin", "http://localhost:5173")
    .send({ status: "CANCELLED", expectedTicketVersion: action.body.ticketVersion });
  expect(changed.status).toBe(200);
  expect(changed.body.version).toBe(action.body.ticketVersion + 1);
  const persisted = await db.actionTaken.findUniqueOrThrow({ where: { id: action.body.action.id } });
  expect(persisted).toMatchObject({ status: "CANCELLED", revision: 2, cancelledById: userIds[2], cancellationSource: "TICKET_CASCADE", followUpRequired: true });
  expect(persisted.cancelledAt).toEqual(changed.body.updatedAt ? new Date(changed.body.updatedAt) : expect.any(Date));
  expect(await db.actionEvent.findFirstOrThrow({ where: { actionId: persisted.id, revision: 2 } })).toMatchObject({ actorId: userIds[2], eventType: "TICKET_CASCADE_CANCELLED", createdAt: persisted.cancelledAt });
});

it("updates content and assignment atomically with append-only events", async () => {
  const created = await createAction();
  const id = created.body.action.id;
  const updated = await staffWrite("patch", `/${id}`, {
    expectedTicketVersion: created.body.ticketVersion, revision: 1, description: "Updated work description", assigneeId: userIds[4],
    followUpRequired: true, followUpNote: "Call the requester after verification.", attachmentNotes: null,
  }, 4);
  expect(updated.status).toBe(200);
  expect(updated.body.action).toMatchObject({ id, revision: 2, description: "Updated work description", assignee: { id: userIds[4] }, followUpRequired: true });
  const events = await staffRead(`/${id}/events`);
  expect(events.status).toBe(200);
  expect(events.body.items.map((event: { revision: number }) => event.revision)).toEqual([1, 2]);
  expect(events.body.items[1]).toMatchObject({ actor: { id: userIds[4] }, eventType: "ACTION_UPDATED", revision: 2 });
  expect(JSON.stringify(events.body)).not.toMatch(/passwordHash|email/);
});

it("returns a no-op Action edit without marking it as an idempotent replay", async () => {
  const created = await createAction();
  const id = created.body.action.id;
  const unchanged = await staffWrite("patch", `/${id}`, {
    expectedTicketVersion: created.body.ticketVersion, revision: 1, description: created.body.action.description,
  });
  expect(unchanged.status).toBe(200);
  expect(unchanged.body).toMatchObject({ action: { id, revision: 1 }, ticketVersion: created.body.ticketVersion });
  expect(unchanged.body).not.toHaveProperty("replayed");
  expect(await db.actionEvent.count({ where: { actionId: id } })).toBe(1);
});

it("allows one concurrent revision update and rejects stale writes without partial events", async () => {
  const created = await createAction();
  const id = created.body.action.id;
  let ticketVersion = created.body.ticketVersion;
  const results = await Promise.all([
    staffWrite("patch", `/${id}`, { expectedTicketVersion: ticketVersion, revision: 1, description: "Concurrent A" }),
    staffWrite("patch", `/${id}`, { expectedTicketVersion: ticketVersion, revision: 1, description: "Concurrent B" }, 4),
  ]);
  expect(results.map(result => result.status).sort()).toEqual([200, 409]);
  expect(results.find(result => result.status === 409)!.body.error.code).toBe("STALE_TICKET");
  ticketVersion = results.find(result => result.status === 200)!.body.ticketVersion;
  const persisted = await db.actionTaken.findUniqueOrThrow({ where: { id } });
  expect(persisted.revision).toBe(2);
  expect(["Concurrent A", "Concurrent B"]).toContain(persisted.description);
  expect(await db.actionEvent.count({ where: { actionId: id } })).toBe(2);
  const stale = await staffWrite("patch", `/${id}`, { expectedTicketVersion: ticketVersion, revision: 1, result: "Must not persist" });
  expect(stale.status).toBe(409);
  expect((await db.actionTaken.findUniqueOrThrow({ where: { id } })).result).toBeNull();
});

it("enforces the Action lifecycle, completion Result and stable audit ordering", async () => {
  const created = await createAction();
  const id = created.body.action.id;
  let ticketVersion = created.body.ticketVersion;
  const invalid = await staffWrite("patch", `/${id}/status`, { expectedTicketVersion: ticketVersion, status: "COMPLETED", revision: 1, result: "Skipped work" });
  expect(invalid.status).toBe(409);
  expect(invalid.body.error.code).toBe("INVALID_ACTION_TRANSITION");
  const started = await staffWrite("patch", `/${id}/status`, { expectedTicketVersion: ticketVersion, status: "IN_PROGRESS", revision: 1 });
  ticketVersion = started.body.ticketVersion;
  expect(started.status).toBe(200);
  const missingResult = await staffWrite("patch", `/${id}/status`, { expectedTicketVersion: ticketVersion, status: "COMPLETED", revision: 2 });
  expect(missingResult.status).toBe(400);
  const completed = await staffWrite("patch", `/${id}/status`, { expectedTicketVersion: ticketVersion, status: "COMPLETED", revision: 2, result: "Connectivity verified." }, 3);
  expect(completed.status).toBe(200);
  expect(completed.body.action).toMatchObject({ status: "COMPLETED", result: "Connectivity verified.", revision: 3, completedAt: expect.any(String), performedBy: { id: userIds[3] } });
  ticketVersion = completed.body.ticketVersion;
  const reopened = await staffWrite("patch", `/${id}/status`, { expectedTicketVersion: ticketVersion, status: "IN_PROGRESS", revision: 3 });
  expect(reopened.status).toBe(409);
  expect(reopened.body.error.code).toBe("INVALID_ACTION_TRANSITION");
  const terminalEdit = await staffWrite("patch", `/${id}`, { expectedTicketVersion: ticketVersion, revision: 3, description: "Should not change" });
  expect(terminalEdit.status).toBe(409);
  const events = await db.actionEvent.findMany({ where: { actionId: id }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
  expect(events.map(event => event.revision)).toEqual([1, 2, 3]);
  expect((await db.actionTaken.findUniqueOrThrow({ where: { id } })).performedById).toBe(userIds[3]);
});

it("coordinates assignment with deactivation and keeps the final assignee eligible", async () => {
  const actionRequest = createBody({ assigneeId: userIds[3] });
  const [assign, deactivate] = await Promise.all([
    staffWrite("post", "", actionRequest),
    request(app).patch(`/api/admin/users/${userIds[3]}`)
      .set("Cookie", `${cookies[4]}; toktickit_csrf=${csrf}`).set("X-CSRF-Token", csrf)
      .set("Origin", "http://localhost:5173").send({ isActive: false }),
  ]);
  expect([assign.status, deactivate.status]).toContain(409);
  expect([assign.status, deactivate.status].some(status => status === 200 || status === 201)).toBe(true);
  const assignee = await db.user.findUniqueOrThrow({ where: { id: userIds[3] } });
  const activeActions = await db.actionTaken.count({ where: { assigneeId: userIds[3], status: { in: ["PLANNED", "IN_PROGRESS"] } } });
  expect(assignee.isActive || activeActions === 0).toBe(true);
  expect((assign.status === 409 ? assign : deactivate).body.error.code).toMatch(/INVALID_ACTION_ASSIGNEE|USER_HAS_ASSIGNED_ACTIONS/);
});

it("returns safe not-found, path, CSRF and unexpected-failure responses", async () => {
  expect((await staffRead("", 2, 2147483647)).status).toBe(404);
  expect((await staffRead("/2147483647")).status).toBe(404);
  expect((await request(app).get("/api/staff/tickets/not-an-id/actions").set("Cookie", cookies[2])).status).toBe(400);
  expect((await request(app).post(staffPath()).set("Cookie", cookies[2]).set("Origin", "http://localhost:5173").send(createBody())).status).toBe(403);
  const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.spyOn(db.actionTaken, "findMany").mockRejectedValueOnce(new Error("database password secret"));
  const failure = await staffRead();
  expect(failure.status).toBe(500);
  expect(failure.body.error.code).toBe("INTERNAL_ERROR");
  expect(failure.body.error.requestId).toBe(failure.headers["x-request-id"]);
  expect(JSON.stringify(failure.body)).not.toContain("database password");
  expect(log).toHaveBeenCalledWith("Request failed", failure.body.error.requestId);
});
