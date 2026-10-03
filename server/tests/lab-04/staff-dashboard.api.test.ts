import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { PrismaClient, Priority, Status } from "@prisma/client";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cookieForUser } from "../session-fixture.js";

const db = new PrismaClient();
vi.mock("../../src/prisma.js", () => ({ getPrisma: () => db }));
import { app } from "../../src/app.js";
import { getStaffDashboard } from "../../src/staff-dashboard.js";

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
    await db.ticket.update({ where: { id: ticket.id }, data: { updatedAt: new Date("2020-01-01T10:00:00.000Z") } });
  }
  for (let index = 0; index < 8; index += 1) {
    const action = await db.actionTaken.create({ data: {
      ticketId: ticketIds[index % ticketIds.length], clientRequestId: randomUUID(), createFingerprint: "f".repeat(64), recordedById: index === 6 || index === 7 ? userIds[1] : userIds[3], description: `Dashboard Action ${index}`,
      result: index === 7 ? "Finished" : null, status: index === 7 ? "COMPLETED" : index === 6 ? "PLANNED" : index % 2 ? "IN_PROGRESS" : "PLANNED",
      performedById: index === 7 ? userIds[1] : null, assigneeId: index === 6 ? userIds[2] : userIds[1],
      completedAt: index === 7 ? new Date("2098-02-01T10:00:00.000Z") : null,
    } });
    actionIds.push(action.id);
    await db.actionTaken.update({ where: { id: action.id }, data: { updatedAt: new Date("2098-02-01T10:00:00.000Z") } });
  }
});

afterEach(() => vi.restoreAllMocks());
afterAll(async () => {
  // Fixture cleanup only, following the existing isolated database suites.
  await db.$executeRawUnsafe('ALTER TABLE "ActionEvent" DISABLE TRIGGER "ActionEvent_reject_update_delete"');
  try { if (actionIds.length) await db.actionEvent.deleteMany({ where: { actionId: { in: actionIds } } }); }
  finally { await db.$executeRawUnsafe('ALTER TABLE "ActionEvent" ENABLE TRIGGER "ActionEvent_reject_update_delete"'); }
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
    expect(Object.keys(response.body.recentlyUpdated[0]).sort()).toEqual(["id", "itPriority", "owner", "resolvedAt", "status", "summary", "ticketNumber", "updatedAt", "version"]);
  });

  it("scopes deduplicated recorded, assigned, and performed Actions and owned counts to the current staff or administrator identity", async () => {
    const response = await dashboard(1);
    const expected = await db.actionTaken.findMany({ where: { OR: [{ recordedById: userIds[1] }, { assigneeId: userIds[1] }, { performedById: userIds[1] }] }, orderBy: [{ updatedAt: "desc" }, { id: "desc" }], take: 5, select: { id: true } });
    expect(response.body.myActions.map((action: { id: number }) => action.id)).toEqual(expected.map(action => action.id));
    expect(response.body.myActions).toHaveLength(5);
    expect(response.body.myActions.find((item: { id: number }) => item.id === actionIds[6]).attribution).toEqual(["RECORDED"]);
    expect(response.body.myActions.find((item: { id: number }) => item.id === actionIds[7]).attribution).toEqual(["RECORDED", "ASSIGNED", "PERFORMED"]);
    expect(new Set(response.body.myActions.map((item: { id: number }) => item.id)).size).toBe(5);

    const administrator = await dashboard(3);
    expect(administrator.status).toBe(200);
    expect(administrator.body.metrics.ownedByMeOpenCount).toBe(await db.ticket.count({ where: { ownerId: userIds[3], status: { in: openStatuses } } }));
    expect(administrator.body.myActions.map((item: { id: number }) => item.id)).toEqual(actionIds.slice(1, 6).reverse());
    expect(administrator.body.myActions.every((item: { attribution: string[] }) => item.attribution.join() === "RECORDED")).toBe(true);
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
    const spoofed = await request(app).get("/api/staff/dashboard").set("Cookie", cookies[1]).set("X-User-Id", String(userIds[3])).set("X-Requester-Id", String(userIds[0]));
    expect(spoofed.status).toBe(200);
    expect(spoofed.body).toMatchObject({ metrics: { ownedByMeOpenCount: await db.ticket.count({ where: { ownerId: userIds[1], status: { in: openStatuses } } }) } });
    expect(spoofed.body.myActions[0].attribution).toEqual(["RECORDED", "ASSIGNED", "PERFORMED"]);
    for (const query of ["userId=1", "ownerId=me", "status=OPEN"]) {
      const response = await request(app).get(`/api/staff/dashboard?${query}`).set("Cookie", cookies[1]);
      expect(response.status).toBe(400); expect(response.body.error.code).toBe("INVALID_QUERY");
    }
  });

  it("reflects accepted Action aggregate writes in recent open Tickets", async () => {
    const ticket = await db.ticket.findFirstOrThrow({ where: { id: { in: ticketIds }, status: "OPEN" } });
    const token = "d".repeat(43);
    const created = await request(app).post(`/api/staff/tickets/${ticket.id}/actions`).set("Cookie", `${cookies[1]}; toktickit_csrf=${token}`).set("X-CSRF-Token", token).set("Origin", "http://localhost:5173").send({ clientRequestId: randomUUID(), expectedTicketVersion: ticket.version, description: "Fresh dashboard work", assigneeId: userIds[1], followUpRequired: false }).expect(201);
    actionIds.push(created.body.action.id);
    const response = await dashboard();
    expect(response.body.recentlyUpdated[0].id).toBe(ticket.id);
    expect(response.body.recentlyUpdated[0].version).toBe(ticket.version + 1);
    const persisted = await db.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(response.body.recentlyUpdated[0].updatedAt).toBe(persisted.updatedAt.toISOString());
  });

  it("returns numeric zero metrics and empty lists from a real empty migrated schema", async () => {
    const schema = `staff_dashboard_zero_test_${randomUUID().replaceAll("-", "")}`;
    const url = new URL(process.env.TEST_DATABASE_URL!);
    url.searchParams.set("schema", schema);
    const empty = new PrismaClient({ datasources: { db: { url: url.toString() } } });
    await db.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
    try {
      execFileSync(process.execPath, [resolve("node_modules/prisma/build/index.js"), "migrate", "deploy"], { env: { ...process.env, DATABASE_URL: url.toString() }, stdio: "pipe", windowsHide: true });
      const response = await getStaffDashboard(empty, userIds[1]);
      expect(response.metrics).toEqual({ unassignedOpenCount: 0, ownedByMeOpenCount: 0, byStatus: Object.fromEntries(Object.values(Status).map(value => [value, 0])), byItPriority: { LOW: 0, MEDIUM: 0, HIGH: 0 } });
      expect(response.myActions).toEqual([]);
      expect(response.recentlyUpdated).toEqual([]);
      expect(response.urgentTickets).toEqual([]);
    } finally {
      await empty.$disconnect();
      await db.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
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
