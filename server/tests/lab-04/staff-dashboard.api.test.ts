import { randomUUID } from "node:crypto";
import { PrismaClient, Priority, Status } from "@prisma/client";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cookieForUser } from "../session-fixture.js";

const db = new PrismaClient();
vi.mock("../../src/prisma.js", () => ({ getPrisma: () => db }));
import { app } from "../../src/app.js";

const marker = randomUUID();
const userIds: number[] = [], ticketIds: number[] = [], actionIds: number[] = [];
const cookies: string[] = [];
let categoryId: number, systemId: number;
const openStatuses: Status[] = ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "REOPENED"];

beforeAll(async () => {
  for (const [index, role] of (["REQUESTER", "IT_STAFF", "IT_STAFF", "ADMINISTRATOR", "IT_STAFF"] as const).entries()) {
    const user = await db.user.create({ data: { displayName: `Dashboard actor ${index}`, email: `${marker}-${index}@example.test`, role, passwordHash: "locked", isActive: true, mustChangePassword: false } });
    userIds.push(user.id); cookies.push(await cookieForUser(db, user.id));
  }
  categoryId = (await db.category.create({ data: { name: `Staff dashboard ${marker}` } })).id;
  systemId = (await db.relatedSystem.create({ data: { name: `Staff dashboard ${marker}` } })).id;
  const statuses = Object.values(Status);
  for (let index = 0; index < statuses.length; index += 1) {
    const ticket = await db.ticket.create({ data: {
      ticketNumber: `TKT-2098-${String(userIds[0] * 10 + index).padStart(6, "0")}`,
      clientRequestId: randomUUID(), summary: `Operational fixture ${index}`, description: "Staff dashboard fixture",
      requestedPriority: "MEDIUM", itPriority: Object.values(Priority)[index % 3], status: statuses[index],
      requesterId: userIds[0], ownerId: openStatuses.includes(statuses[index]) ? (index % 3 === 0 ? null : index % 3 === 1 ? userIds[1] : userIds[2]) : null,
      categoryId, relatedSystemId: systemId,
    } });
    ticketIds.push(ticket.id);
    await db.ticket.update({ where: { id: ticket.id }, data: { updatedAt: new Date(`2098-01-${String(index + 1).padStart(2, "0")}T10:00:00.000Z`) } });
  }
  for (let index = 0; index < 8; index += 1) {
    const action = await db.actionTaken.create({ data: {
      ticketId: ticketIds[index % ticketIds.length], clientRequestId: randomUUID(), description: `Dashboard Action ${index}`,
      result: index === 7 ? "Finished" : null, status: index === 7 ? "COMPLETED" : index === 6 ? "PLANNED" : index % 2 ? "IN_PROGRESS" : "PLANNED",
      performedById: userIds[3], assigneeId: index === 6 ? userIds[2] : userIds[1],
      completedAt: index === 7 ? new Date("2098-02-01T10:00:00.000Z") : null,
    } });
    actionIds.push(action.id);
    await db.actionTaken.update({ where: { id: action.id }, data: { updatedAt: new Date(`2098-02-${String(index + 1).padStart(2, "0")}T10:00:00.000Z`) } });
  }
});

afterEach(() => vi.restoreAllMocks());
afterAll(async () => {
  if (actionIds.length) await db.actionTaken.deleteMany({ where: { id: { in: actionIds } } });
  await db.ticket.deleteMany({ where: { id: { in: ticketIds } } });
  await db.session.deleteMany({ where: { userId: { in: userIds } } });
  await db.user.deleteMany({ where: { id: { in: userIds } } });
  await db.category.delete({ where: { id: categoryId } }); await db.relatedSystem.delete({ where: { id: systemId } });
  await db.$disconnect();
});

const dashboard = (actor = 1) => request(app).get("/api/staff/dashboard").set("Cookie", cookies[actor]);

describe("GET /api/staff/dashboard", () => {
  it("matches authoritative database counts and returns bounded, ordered operational summaries", async () => {
    const response = await dashboard();
    expect(response.status).toBe(200);
    const expectedUnassigned = await db.ticket.count({ where: { ownerId: null, status: { in: openStatuses } } });
    const expectedMine = await db.ticket.count({ where: { ownerId: userIds[1], status: { in: openStatuses } } });
    expect(response.body.metrics.unassignedOpenCount).toBe(expectedUnassigned);
    expect(response.body.metrics.ownedByMeOpenCount).toBe(expectedMine);
    for (const status of Object.values(Status)) expect(response.body.metrics.byStatus[status]).toBe(await db.ticket.count({ where: { status } }));
    for (const priority of Object.values(Priority)) expect(response.body.metrics.byItPriority[priority]).toBe(await db.ticket.count({ where: { itPriority: priority } }));

    const expectedRecent = await db.ticket.findMany({ where: { status: { in: openStatuses } }, orderBy: [{ updatedAt: "desc" }, { id: "desc" }], take: 5, select: { id: true } });
    const expectedUrgent = await db.ticket.findMany({ where: { itPriority: "HIGH" }, orderBy: [{ updatedAt: "asc" }, { id: "asc" }], take: 5, select: { id: true } });
    expect(response.body.recentlyUpdated.map((item: { id: number }) => item.id)).toEqual(expectedRecent.map(item => item.id));
    expect(response.body.urgentTickets.map((item: { id: number }) => item.id)).toEqual(expectedUrgent.map(item => item.id));
    expect(response.body.recentlyUpdated.length).toBeLessThanOrEqual(5);
    expect(response.body.urgentTickets.length).toBeLessThanOrEqual(5);
    expect(response.body.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/);
    expect(Object.keys(response.body.recentlyUpdated[0]).sort()).toEqual(["id", "itPriority", "owner", "status", "summary", "ticketNumber", "updatedAt"]);
  });

  it("scopes active Actions and owned counts to the current staff or administrator identity", async () => {
    const response = await dashboard(1);
    const expected = await db.actionTaken.findMany({ where: { assigneeId: userIds[1], status: { in: ["PLANNED", "IN_PROGRESS"] } }, orderBy: [{ updatedAt: "desc" }, { id: "desc" }], take: 5, select: { id: true } });
    expect(response.body.myActions.map((action: { id: number }) => action.id)).toEqual(expected.map(action => action.id));
    expect(response.body.myActions).toHaveLength(5);
    expect(JSON.stringify(response.body.myActions)).not.toContain("Dashboard Action 6");
    expect(JSON.stringify(response.body.myActions)).not.toContain("Dashboard Action 7");

    const administrator = await dashboard(3);
    expect(administrator.status).toBe(200);
    expect(administrator.body.metrics.ownedByMeOpenCount).toBe(await db.ticket.count({ where: { ownerId: userIds[3], status: { in: openStatuses } } }));
    expect(administrator.body.myActions).toEqual([]);
    const zeroActor = await dashboard(4);
    expect(zeroActor.body.metrics.ownedByMeOpenCount).toBe(0);
    expect(zeroActor.body.myActions).toEqual([]);
  });

  it("keeps Queue drill-down totals equivalent to dashboard metrics", async () => {
    const response = await dashboard(1);
    const queue = async (query: string) => request(app).get(`/api/staff/tickets?${query}`).set("Cookie", cookies[1]);
    expect((await queue("ownerId=unassigned&status=OPEN_GROUP")).body.pagination.totalItems).toBe(response.body.metrics.unassignedOpenCount);
    expect((await queue("ownerId=me&status=OPEN_GROUP")).body.pagination.totalItems).toBe(response.body.metrics.ownedByMeOpenCount);
    for (const status of Object.values(Status)) expect((await queue(`status=${status}`)).body.pagination.totalItems).toBe(response.body.metrics.byStatus[status]);
    for (const priority of Object.values(Priority)) expect((await queue(`itPriority=${priority}`)).body.pagination.totalItems).toBe(response.body.metrics.byItPriority[priority]);
  });

  it("enforces roles and rejects identity/query overrides", async () => {
    expect((await request(app).get("/api/staff/dashboard")).status).toBe(401);
    expect((await dashboard(0)).status).toBe(403);
    for (const query of ["userId=1", "ownerId=me", "status=OPEN"]) {
      const response = await request(app).get(`/api/staff/dashboard?${query}`).set("Cookie", cookies[1]);
      expect(response.status).toBe(400); expect(response.body.error.code).toBe("INVALID_QUERY");
    }
  });

  it("returns a safe unexpected failure", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(db, "$transaction").mockRejectedValueOnce(new Error("postgres://admin:secret@private"));
    const response = await dashboard();
    expect(response.status).toBe(500); expect(response.body.error).toMatchObject({ code: "INTERNAL_ERROR", message: "The request could not be completed." });
    expect(response.text).not.toMatch(/postgres|admin|secret|private/);
  });
});
