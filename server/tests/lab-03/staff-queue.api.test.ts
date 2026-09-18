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
      requestedPriority: "HIGH", itPriority: i === 0 ? "LOW" : "HIGH", status: i === 0 ? "OPEN" : "NEW", ownerId: i === 0 ? ids[1] : null, updatedAt: new Date("2026-09-01") } }); tickets.push(ticket.id);
  }
});
afterAll(async () => {
  await db.ticket.deleteMany({ where: { requesterId: { in: ids } } });
  await db.session.deleteMany({ where: { userId: { in: ids } } }); await db.user.deleteMany({ where: { id: { in: ids } } });
  if (categoryId) await db.category.delete({ where: { id: categoryId } });
  if (relatedSystemId) await db.relatedSystem.delete({ where: { id: relatedSystemId } }); await db.$disconnect();
});
const get = (query = "", user = 1) => request(app).get(`/api/staff/tickets?search=${marker}${query}`).set("Cookie", cookies[user]);
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
  it("copies Requested Priority on creation and preserves Requester access to new statuses", async () => {
    const created = await request(app).post("/api/tickets").set("Cookie", cookies[0]).set("Origin", "http://localhost:5173")
      .send({ clientRequestId: randomUUID(), summary: "Priority copy regression", description: "New ticket priority must match the requested value.", requestedPriority: "LOW", categoryId, relatedSystemId });
    expect(created.status).toBe(201);
    expect(await db.ticket.findUnique({ where: { id: created.body.ticket.id } })).toMatchObject({ itPriority: "LOW", ownerId: null });
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
