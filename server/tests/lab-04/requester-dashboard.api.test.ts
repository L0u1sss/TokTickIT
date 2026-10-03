import { randomUUID } from "node:crypto";
import { PrismaClient, type Status } from "@prisma/client";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cookieForUser } from "../session-fixture.js";

const db = new PrismaClient();
vi.mock("../../src/prisma.js", () => ({ getPrisma: () => db }));
import { app } from "../../src/app.js";

const marker = randomUUID();
const userIds: number[] = [];
const ticketIds: number[] = [];
let categoryId: number;
let systemId: number;
let requesterCookie: string;
let emptyRequesterCookie: string;
let staffCookie: string;
let adminCookie: string;

beforeAll(async () => {
  for (const [index, role] of (["REQUESTER", "REQUESTER", "REQUESTER", "IT_STAFF", "ADMINISTRATOR"] as const).entries()) {
    const user = await db.user.create({ data: {
      displayName: `Dashboard ${index}`,
      email: `${marker}-${index}@example.test`,
      role,
      isActive: true,
      passwordHash: "locked",
      mustChangePassword: false,
    } });
    userIds.push(user.id);
  }
  [requesterCookie, emptyRequesterCookie, staffCookie, adminCookie] = await Promise.all([
    cookieForUser(db, userIds[0]),
    cookieForUser(db, userIds[1]),
    cookieForUser(db, userIds[3]),
    cookieForUser(db, userIds[4]),
  ]);
  categoryId = (await db.category.create({ data: { name: `Dashboard ${marker}` } })).id;
  systemId = (await db.relatedSystem.create({ data: { name: `Dashboard ${marker}` } })).id;

  const statuses: Status[] = ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "REOPENED", "RESOLVED", "CLOSED", "CANCELLED"];
  for (let index = 0; index < 8; index += 1) {
    const ticket = await db.ticket.create({ data: {
      ticketNumber: `TKT-2097-${String(userIds[0] * 10 + index).padStart(6, "0")}`,
      clientRequestId: randomUUID(),
      summary: `Owned dashboard ticket ${index}`,
      description: "Requester dashboard integration fixture",
      requestedPriority: "MEDIUM",
      itPriority: "MEDIUM",
      status: statuses[index],
      resolvedAt: ["RESOLVED", "CLOSED"].includes(statuses[index]) ? new Date(Date.now() - (8 - index) * 3600000) : null,
      requesterId: userIds[0],
      categoryId,
      relatedSystemId: systemId,
    } });
    ticketIds.push(ticket.id);
    await db.ticket.update({ where: { id: ticket.id }, data: { updatedAt: new Date(`2026-09-${String(index + 1).padStart(2, "0")}T10:00:00.000Z`) } });
  }
  const foreign = await db.ticket.create({ data: {
    ticketNumber: `TKT-2098-${String(userIds[2]).padStart(6, "0")}`,
    clientRequestId: randomUUID(),
    summary: "Another requester private ticket",
    description: "Must never appear on the first requester dashboard",
    requestedPriority: "HIGH",
    itPriority: "HIGH",
    status: "WAITING_FOR_REQUESTER",
    requesterId: userIds[2],
    categoryId,
    relatedSystemId: systemId,
  } });
  ticketIds.push(foreign.id);
  await db.ticket.update({ where: { id: foreign.id }, data: { updatedAt: new Date("2026-12-31T23:59:59.000Z") } });
});

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });
afterAll(async () => {
  await db.ticket.deleteMany({ where: { id: { in: ticketIds } } });
  await db.session.deleteMany({ where: { userId: { in: userIds } } });
  await db.user.deleteMany({ where: { id: { in: userIds } } });
  await db.category.delete({ where: { id: categoryId } });
  await db.relatedSystem.delete({ where: { id: systemId } });
  await db.$disconnect();
});

describe("GET /api/dashboard/requester", () => {
  it("returns authoritative counts and bounded, ordered summaries for only the authenticated requester", async () => {
    const response = await request(app).get("/api/dashboard/requester")
      .set("Cookie", requesterCookie).set("X-Requester-Id", String(userIds[2])).expect(200);

    expect(response.body.metrics).toEqual({ openCount: 5, waitingForRequesterCount: 1 });
    expect(response.body.recentlyUpdated).toHaveLength(5);
    expect(response.body.recentlyUpdated.map((ticket: { summary: string }) => ticket.summary)).toEqual([
      "Owned dashboard ticket 7", "Owned dashboard ticket 6", "Owned dashboard ticket 5",
      "Owned dashboard ticket 4", "Owned dashboard ticket 3",
    ]);
    expect(response.body.recentlyResolved.map((ticket: { status: string }) => ticket.status)).toEqual(["Closed", "Resolved"]);
    expect(JSON.stringify(response.body)).not.toContain("Another requester private ticket");
    expect(response.body.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

    const openCount = await db.ticket.count({ where: { requesterId: userIds[0], status: { in: ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "REOPENED"] } } });
    expect(response.body.metrics.openCount).toBe(openCount);
    expect(Object.keys(response.body.recentlyUpdated[0]).sort()).toEqual([
      "activeAttachmentCount", "category", "createdAt", "id", "relatedSystem", "requestedPriority", "status", "summary", "ticketNumber", "updatedAt", "version", "resolvedAt",
    ].sort());
  });

  it("returns a stable empty dashboard for a requester with no Tickets", async () => {
    const response = await request(app).get("/api/dashboard/requester").set("Cookie", emptyRequesterCookie).expect(200);
    expect(response.body).toMatchObject({ metrics: { openCount: 0, waitingForRequesterCount: 0 }, recentlyUpdated: [], recentlyResolved: [] });
  });

  it("intentionally includes old Tickets of every status in Recently Updated without a time cutoff", async () => {
    const originals = await db.ticket.findMany({ where: { requesterId: userIds[0] }, orderBy: { id: "asc" } });
    const old = new Date(Date.now() - 30 * 24 * 3600000);
    try {
      // Equal old timestamps also exercise the descending ID tie-breaker.
      await db.ticket.updateMany({ where: { requesterId: userIds[0] }, data: { updatedAt: old } });
      const response = await request(app).get("/api/dashboard/requester").set("Cookie", requesterCookie).expect(200);
      expect(response.body.recentlyUpdated.map((row: { id: number }) => row.id)).toEqual(originals.slice(-5).reverse().map(row => row.id));
      expect(response.body.recentlyUpdated.map((row: { status: string }) => row.status)).toEqual(["Cancelled", "Closed", "Resolved", "Reopened", "Waiting For Requester"]);
      const cutoff = Date.parse(response.body.generatedAt) - 168 * 3600000;
      expect(response.body.recentlyUpdated.every((row: { updatedAt: string }) => Date.parse(row.updatedAt) < cutoff)).toBe(true);
    } finally {
      for (const row of originals) await db.ticket.update({ where: { id: row.id }, data: { updatedAt: row.updatedAt } });
    }
  });

  it("enforces authentication, role authorization, and the query contract", async () => {
    expect((await request(app).get("/api/dashboard/requester")).status).toBe(401);
    expect((await request(app).get("/api/dashboard/requester").set("Cookie", staffCookie)).status).toBe(403);
    expect((await request(app).get("/api/dashboard/requester").set("Cookie", adminCookie)).status).toBe(403);
    const invalid = await request(app).get("/api/dashboard/requester?requesterId=999").set("Cookie", requesterCookie);
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe("INVALID_QUERY");
  });

  it("uses a half-open seven-day resolvedAt window, stable ties, five-item limits, and matching owned drill-down", async () => {
    const before = new Date(), from = new Date(before.getTime() - 168 * 3600000);
    vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(before);
    const cases = [
      { status: "RESOLVED", resolvedAt: from },
      ...Array.from({ length: 6 }, () => ({ status: "CLOSED" as const, resolvedAt: new Date(before.getTime() - 3600000) })),
      { status: "RESOLVED", resolvedAt: new Date(from.getTime() - 1) },
      { status: "CLOSED", resolvedAt: before },
      { status: "RESOLVED", resolvedAt: new Date(before.getTime() + 1) },
      { status: "RESOLVED", resolvedAt: null },
      { status: "REOPENED", resolvedAt: new Date(before.getTime() - 3600000) },
    ] as const;
    const boundaryIds: number[] = [];
    for (const [index, data] of cases.entries()) {
      const row = await db.ticket.create({ data: { ...data, ticketNumber: `TKT-2096-${String(userIds[0] * 100 + index).padStart(6, "0")}`, clientRequestId: randomUUID(), summary: `Resolution boundary ${index}`, description: "Window boundary", requestedPriority: "MEDIUM", itPriority: "MEDIUM", requesterId: userIds[0], categoryId, relatedSystemId: systemId } });
      ticketIds.push(row.id); boundaryIds.push(row.id);
    }
    const response = await request(app).get("/api/dashboard/requester").set("Cookie", requesterCookie).expect(200);
    expect(response.body.recentlyResolvedWindow).toEqual({ from: from.toISOString(), before: before.toISOString() });
    expect(response.body.generatedAt).toBe(before.toISOString());
    const expected = await db.ticket.findMany({ where: { requesterId: userIds[0], status: { in: ["RESOLVED", "CLOSED"] }, resolvedAt: { gte: from, lt: before } }, orderBy: [{ resolvedAt: "desc" }, { id: "desc" }] });
    expect(response.body.recentlyResolved.map((item: { id: number }) => item.id)).toEqual(expected.slice(0, 5).map(item => item.id));
    const drillDown = await request(app).get("/api/tickets").query({ statusIn: "RESOLVED,CLOSED", resolvedFrom: from.toISOString(), resolvedBefore: before.toISOString(), pageSize: 50 }).set("Cookie", requesterCookie).set("X-Requester-Id", String(userIds[2])).expect(200);
    expect(drillDown.body.pagination.totalItems).toBe(expected.length);
    expect(drillDown.body.items.map((item: { id: number }) => item.id).sort((a: number, b: number) => a - b)).toEqual(expected.map(item => item.id).sort((a, b) => a - b));
    expect(drillDown.body.items.some((item: { id: number }) => item.id === boundaryIds[0])).toBe(true);
    expect(drillDown.body.items.some((item: { id: number }) => boundaryIds.slice(7).includes(item.id))).toBe(false);
    for (const [status, count] of [["OPEN_GROUP", response.body.metrics.openCount], ["WAITING_FOR_REQUESTER", response.body.metrics.waitingForRequesterCount]] as const) {
      const list = await request(app).get("/api/tickets").query({ status }).set("Cookie", requesterCookie).expect(200);
      expect(list.body.pagination.totalItems).toBe(count);
    }
  });

  it("reflects accepted staff aggregate mutations in Recently Updated", async () => {
    const id = ticketIds[1], token = "d".repeat(43);
    const ticket = await db.ticket.findUniqueOrThrow({ where: { id } });
    await request(app).patch(`/api/staff/tickets/${id}/it-priority`).set("Cookie", `${staffCookie}; toktickit_csrf=${token}`).set("X-CSRF-Token", token).set("Origin", "http://localhost:5173").send({ itPriority: "HIGH", expectedTicketVersion: ticket.version }).expect(200);
    const dashboard = await request(app).get("/api/dashboard/requester").set("Cookie", requesterCookie).expect(200);
    expect(dashboard.body.recentlyUpdated[0].id).toBe(id);
    expect(dashboard.body.recentlyUpdated[0].version).toBe(ticket.version + 1);
  });

  it("returns a safe failure without exposing database details", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(db, "$transaction").mockRejectedValueOnce(new Error("postgres://admin:secret@private"));
    const response = await request(app).get("/api/dashboard/requester").set("Cookie", requesterCookie);
    expect(response.status).toBe(500);
    expect(response.body.error).toMatchObject({ code: "INTERNAL_ERROR", message: "The request could not be completed." });
    expect(response.text).not.toMatch(/postgres|admin|secret|private/);
  });
});
