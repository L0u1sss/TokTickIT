import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PrismaClient, type UserRole } from "@prisma/client";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { cookieForUser } from "../session-fixture.js";
const db = new PrismaClient();
vi.mock("../../src/prisma.js", () => ({ getPrisma: () => db }));
import { app } from "../../src/app.js";
const marker = randomUUID(), ids: number[] = [], cookies: string[] = [], tickets: number[] = [];
let categoryId: number, relatedSystemId: number;
beforeAll(async () => {
  for (const [index, role] of (["REQUESTER", "IT_STAFF", "ADMINISTRATOR", "IT_STAFF"] as UserRole[]).entries()) {
    const user = await db.user.create({ data: { displayName: `Queue person ${index} ${marker}`, email: `queue-${index}-${marker}@example.test`, role, passwordHash: "locked", mustChangePassword: false, isActive: index !== 3 } });
    ids.push(user.id); cookies.push(await cookieForUser(db, user.id));
  }
  categoryId = (await db.category.create({ data: { name: marker } })).id;
  relatedSystemId = (await db.relatedSystem.create({ data: { name: marker } })).id;
  for (let i = 0; i < 3; i++) {
    const ticket = await db.ticket.create({ data: { ticketNumber: `TKT-2099-${String(ids[0] * 3 + i).padStart(6, "0")}`, clientRequestId: randomUUID(), summary: `${marker} printer ${i}`, description: "Private ticket detail", requesterId: ids[0], categoryId, relatedSystemId,
      requestedPriority: "HIGH", itPriority: "HIGH", status: i === 0 ? "OPEN" : "NEW", ownerId: i === 0 ? ids[1] : null, updatedAt: new Date("2026-09-01") } });
    // Model a subsequent staff adjustment separately from initial creation.
    if (i === 0) await db.ticket.update({ where: { id: ticket.id }, data: { itPriority: "LOW", updatedAt: new Date("2026-09-01") } });
    tickets.push(ticket.id);
  }
});
afterAll(async () => {
  await db.ticket.deleteMany({ where: { requesterId: { in: ids } } });
  await db.session.deleteMany({ where: { userId: { in: ids } } }); await db.user.deleteMany({ where: { id: { in: ids } } });
  if (categoryId) await db.category.delete({ where: { id: categoryId } });
  if (relatedSystemId) await db.relatedSystem.delete({ where: { id: relatedSystemId } }); await db.$disconnect();
});
const get = (query = "", user = 1) => request(app).get(`/api/staff/tickets?search=${marker}${query}`).set("Cookie", cookies[user]);

describe("ownerId=me authenticated identity isolation", () => {
  const identityMarker = randomUUID();
  const actors: Array<{ id: number; cookie: string }> = [];
  const assignments: Array<{ id: number; ownerId: number | null }> = [];
  let identityCategoryId: number, identitySystemId: number;

  beforeAll(async () => {
    // Real persisted sessions exercise the auth middleware for both operational roles.
    // This fixture has its own requester/search marker, independent of the original queue.
    for (const [index, role] of (["REQUESTER", "IT_STAFF", "ADMINISTRATOR", "IT_STAFF"] as const).entries()) {
      const actor = await db.user.create({ data: { displayName: `Identity actor ${index} ${identityMarker}`,
        email: `identity-${index}-${identityMarker}@example.test`, role, passwordHash: "locked", mustChangePassword: false } });
      actors.push({ id: actor.id, cookie: await cookieForUser(db, actor.id) });
    }
    identityCategoryId = (await db.category.create({ data: { name: `Identity ${identityMarker}` } })).id;
    identitySystemId = (await db.relatedSystem.create({ data: { name: `Identity ${identityMarker}` } })).id;
    for (const [index, ownerId] of [actors[1].id, actors[1].id, actors[2].id, null].entries()) {
      const ticket = await db.ticket.create({ data: {
        ticketNumber: `TKT-2096-${String(actors[0].id * 4 + index).padStart(6, "0")}`, clientRequestId: randomUUID(),
        summary: `Identity isolation ${identityMarker}`, description: "Separate staff and administrator assignments from unassigned tickets.",
        requestedPriority: "HIGH", itPriority: "HIGH", requesterId: actors[0].id, ownerId,
        categoryId: identityCategoryId, relatedSystemId: identitySystemId,
      } });
      assignments.push({ id: ticket.id, ownerId });
    }
  });

  afterAll(async () => {
    const actorIds = actors.map(actor => actor.id);
    await db.ticket.deleteMany({ where: { requesterId: { in: actorIds } } });
    await db.session.deleteMany({ where: { userId: { in: actorIds } } });
    await db.user.deleteMany({ where: { id: { in: actorIds } } });
    if (identityCategoryId) await db.category.delete({ where: { id: identityCategoryId } });
    if (identitySystemId) await db.relatedSystem.delete({ where: { id: identitySystemId } });
  });

  const mine = (actorIndex: number, suffix = "") => request(app)
    .get(`/api/staff/tickets?search=${identityMarker}&ownerId=me&sortBy=ticketNumber&sortOrder=asc${suffix}`)
    .set("Cookie", actors[actorIndex].cookie);

  const assertOwnAssignments = (response: { status: number; body: { items: Array<{ id: number; owner: { id: number } | null }>; pagination: { totalItems: number } } }, actorIndex: number) => {
    const expected = assignments.filter(ticket => ticket.ownerId === actors[actorIndex].id);
    expect(response.status).toBe(200);
    expect(response.body.items.map(ticket => ({ id: ticket.id, ownerId: ticket.owner?.id ?? null }))).toEqual(expected);
    expect(response.body.pagination.totalItems).toBe(expected.length);
  };

  it.each([[1, "Staff A"], [2, "Administrator B"], [3, "Staff C without assignments"]] as const)(
    "resolves me using the session for %s (%s), excluding other owners and unassigned tickets", async (actorIndex, label) => {
      void label;
      assertOwnAssignments(await mine(actorIndex), actorIndex);
    },
  );

  it.each([1, 2, 3])("ignores spoofed requester/user headers for authenticated actor %s", async actorIndex => {
    const otherOwner = actorIndex === 1 ? actors[2] : actors[1];
    const response = await mine(actorIndex)
      .set("x-requester-id", String(otherOwner.id))
      .set("x-user-id", String(otherOwner.id))
      .set("x-owner-id", String(otherOwner.id));
    assertOwnAssignments(response, actorIndex);
  });

  it.each([
    [1, "requesterId"], [2, "requesterId"], [1, "userId"], [2, "userId"],
    [1, "ownerId"], [2, "ownerId"], [1, "ownerId[id]"], [2, "ownerId[id]"],
  ] as const)("rejects client identity override %s / %s instead of reinterpreting me", async (actorIndex, field) => {
    const otherOwner = actorIndex === 1 ? actors[2] : actors[1];
    const response = await mine(actorIndex, `&${encodeURIComponent(field)}=${otherOwner.id}`);
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_QUERY");
    expect(response.body).not.toHaveProperty("items");
  });

  it.each([1, 2])("rejects duplicate ownerId even when me is the last value for actor %s", async actorIndex => {
    const otherOwner = actorIndex === 1 ? actors[2] : actors[1];
    const response = await request(app)
      .get(`/api/staff/tickets?search=${identityMarker}&ownerId=${otherOwner.id}&ownerId=me`)
      .set("Cookie", actors[actorIndex].cookie);
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_QUERY");
    expect(response.body).not.toHaveProperty("items");
  });
});

describe("staff queue API", () => {
  it("enforces session and roles for queue, assignees and details", async () => {
    for (const path of ["/api/staff/tickets", "/api/staff/assignees", `/api/staff/tickets/${tickets[0]}`]) {
      expect((await request(app).get(path)).status).toBe(401);
      expect((await request(app).get(path).set("Cookie", cookies[0])).status).toBe(403);
      expect((await request(app).get(path).set("Cookie", cookies[3])).status).toBe(401);
      expect((await request(app).get(path).set("Cookie", cookies[2])).status).toBe(200);
    }
  });
  it("uses deterministic pagination and omits credentials and detail content", async () => {
    const first = await get("&pageSize=2"); expect(first.status).toBe(200);
    expect(first.body.items.map((row: { id: number }) => row.id)).toEqual([tickets[2], tickets[1]]);
    expect(first.body.pagination).toEqual({ page: 1, pageSize: 2, totalItems: 3, totalPages: 2 });
    expect(first.body.items[0]).not.toHaveProperty("description"); expect(first.body.items[0].requester).not.toHaveProperty("passwordHash");
    expect((await get("&pageSize=2&page=2")).body.items.map((row: { id: number }) => row.id)).toEqual([tickets[0]]);
    expect((await get("&page=999")).body.items).toEqual([]);
  });
  it("combines status, priorities and ownership without requester scope", async () => {
    expect((await get("&status=OPEN&itPriority=LOW&requestedPriority=HIGH&ownerId=me")).body.items.map((row: { id: number }) => row.id)).toEqual([tickets[0]]);
    expect((await get("&ownerId=unassigned")).body.items).toHaveLength(2);
    expect((await get(`&ownerId=${ids[1]}`)).body.items).toHaveLength(1);
    for (const id of [ids[0], ids[3], 2147483647]) expect((await get(`&ownerId=${id}`)).status).toBe(400);
  });
  it("searches requester email/name and ticket number case-insensitively", async () => {
    for (const term of [`QUEUE-0-${marker}`, `QUEUE PERSON 0 ${marker}`, `tkt-2099-${String(ids[0] * 3).padStart(6, "0")}`]) {
      const result = await request(app).get("/api/staff/tickets").query({ search: term }).set("Cookie", cookies[1]);
      expect(result.status).toBe(200); expect(result.body.items.length).toBeGreaterThan(0);
    }
  });
  it("sorts priority by LOW/MEDIUM/HIGH rank and validates queries", async () => {
    expect((await get("&sortBy=itPriority&sortOrder=asc")).body.items[0].id).toBe(tickets[0]);
    for (const query of ["&page=0", "&status=bad", "&sortBy=wrong", "&page=1&page=2", "&unknown=1"])
      expect((await get(query)).body.error.code).toBe("INVALID_QUERY");
  });
  it("returns only active eligible assignees and safe read-only details", async () => {
    const result = await request(app).get("/api/staff/assignees").set("Cookie", cookies[1]);
    const returned = result.body.items.map((u: { id: number }) => u.id);
    expect(returned).toContain(ids[1]); expect(returned).toContain(ids[2]); expect(returned).not.toContain(ids[0]); expect(returned).not.toContain(ids[3]);
    const detail = await request(app).get(`/api/staff/tickets/${tickets[0]}`).set("Cookie", cookies[1]);
    expect(detail.body.description).toBe("Private ticket detail"); expect(detail.body.owner.id).toBe(ids[1]);
    expect((await request(app).get("/api/staff/tickets/2147483647").set("Cookie", cookies[1])).status).toBe(404);
  });
  it.each(["LOW", "MEDIUM", "HIGH"])("copies %s Requested Priority on creation and replay", async requestedPriority => {
    const input = { clientRequestId: randomUUID(), summary: "Priority copy regression", description: "New ticket priority must match the requested value.", requestedPriority, categoryId, relatedSystemId };
    const created = await request(app).post("/api/tickets").set("Cookie", cookies[0]).set("Origin", "http://localhost:5173")
      .send(input);
    expect(created.status).toBe(201);
    expect(await db.ticket.findUnique({ where: { id: created.body.ticket.id } })).toMatchObject({ requestedPriority, itPriority: requestedPriority, ownerId: null });
    const replay = await request(app).post("/api/tickets").set("Cookie", cookies[0]).set("Origin", "http://localhost:5173").send(input);
    expect(replay.status).toBe(200); expect(replay.body.ticket.id).toBe(created.body.ticket.id);
    expect(await db.ticket.count({ where: { clientRequestId: input.clientRequestId } })).toBe(1);
  });
  it.each(["LOW", "HIGH"])("rejects direct %s inserts that omit IT Priority instead of silently defaulting", async requestedPriority => {
    const clientRequestId = randomUUID();
    const ticketNumber = requestedPriority === "LOW" ? "TKT-2098-999998" : "TKT-2098-999999";
    await expect(db.$executeRaw`INSERT INTO "Ticket" ("ticketNumber", "clientRequestId", summary, description, "requestedPriority", "requesterId", "categoryId", "relatedSystemId", "updatedAt")
      VALUES (${ticketNumber}, ${clientRequestId}::uuid, 'Missing IT Priority', 'The missing priority must reject this insert.', ${requestedPriority}::"Priority", ${ids[0]}, ${categoryId}, ${relatedSystemId}, CURRENT_TIMESTAMP)`)
      .rejects.toMatchObject({ code: "P2010", meta: { code: "23502" } });
    expect(await db.ticket.count({ where: { clientRequestId } })).toBe(0);
  });
  it("requires explicit IT Priority in the migrated database schema", async () => {
    expect(await db.$queryRaw`SELECT column_default, is_nullable FROM information_schema.columns
      WHERE table_schema = current_schema() AND table_name = 'Ticket' AND column_name = 'itPriority'`)
      .toEqual([{ column_default: null, is_nullable: "NO" }]);
  });
  it("preserves Requester access to new statuses", async () => {
    const detail = await request(app).get(`/api/tickets/${tickets[0]}`).set("Cookie", cookies[0]);
    expect(detail.status).toBe(200); expect(detail.body.status).toBe("Open");
    expect((await request(app).get("/api/tickets").set("Cookie", cookies[0])).status).toBe(200);
  });
  it("does not disclose database failures", async () => {
    const spy = vi.spyOn(db, "$transaction").mockRejectedValueOnce(new Error("private database connection"));
    try {
      const result = await get(); expect(result.status).toBe(500); expect(result.body.error.code).toBe("INTERNAL_ERROR");
      expect(JSON.stringify(result.body)).not.toContain("private database");
    } finally { spy.mockRestore(); }
  });
});
