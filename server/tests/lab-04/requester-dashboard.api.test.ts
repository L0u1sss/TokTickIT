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

beforeAll(async () => {
  for (const [index, role] of (["REQUESTER", "REQUESTER", "REQUESTER", "IT_STAFF"] as const).entries()) {
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
  [requesterCookie, emptyRequesterCookie, staffCookie] = await Promise.all([
    cookieForUser(db, userIds[0]),
    cookieForUser(db, userIds[1]),
    cookieForUser(db, userIds[3]),
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

afterEach(() => vi.restoreAllMocks());
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
      "activeAttachmentCount", "category", "createdAt", "id", "relatedSystem", "requestedPriority", "status", "summary", "ticketNumber", "updatedAt",
    ]);
  });

  it("returns a stable empty dashboard for a requester with no Tickets", async () => {
    const response = await request(app).get("/api/dashboard/requester").set("Cookie", emptyRequesterCookie).expect(200);
    expect(response.body).toMatchObject({ metrics: { openCount: 0, waitingForRequesterCount: 0 }, recentlyUpdated: [], recentlyResolved: [] });
  });

  it("enforces authentication, role authorization, and the query contract", async () => {
    expect((await request(app).get("/api/dashboard/requester")).status).toBe(401);
    expect((await request(app).get("/api/dashboard/requester").set("Cookie", staffCookie)).status).toBe(403);
    const invalid = await request(app).get("/api/dashboard/requester?requesterId=999").set("Cookie", requesterCookie);
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe("INVALID_QUERY");
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
