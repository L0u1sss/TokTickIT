import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { performance } from "node:perf_hooks";
import { PrismaClient, Status, Priority, type Prisma } from "@prisma/client";
import request from "supertest";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { cookieForUser } from "../session-fixture.js";

const admin = new PrismaClient();
const schema = `lab4_perf_test_${randomUUID().replaceAll("-", "")}`;
const url = new URL(process.env.TEST_DATABASE_URL!);
url.searchParams.set("schema", schema);
const db = new PrismaClient({ datasources: { db: { url: url.toString() } } });
vi.mock("../../src/prisma.js", () => ({ getPrisma: () => db }));
import { app } from "../../src/app.js";

let created = false;
const cookies: string[] = [], ids: number[] = [];
const statuses = Object.values(Status), priorities = Object.values(Priority);
const warmup = 5, sampleCount = 40, thresholdMs = 500;

beforeAll(async () => {
  await admin.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`); created = true;
  execFileSync(process.execPath, [resolve("node_modules/prisma/build/index.js"), "migrate", "deploy"], {
    env: { ...process.env, DATABASE_URL: url.toString() }, stdio: "pipe", windowsHide: true,
  });
  for (const [index, role] of (["REQUESTER", "IT_STAFF", "ADMINISTRATOR", "REQUESTER"] as const).entries()) {
    const user = await db.user.create({ data: { email: `perf-${index}@example.test`, displayName: `Performance ${role} ${index}`, passwordHash: "locked", role, mustChangePassword: false } });
    ids.push(user.id);
  }
  const category = await db.category.create({ data: { name: "Performance hardware" } });
  const system = await db.relatedSystem.create({ data: { name: "Performance office" } });
  const now = Date.now();
  await db.ticket.createMany({ data: Array.from({ length: 1000 }, (_, index) => ({
    ticketNumber: `TKT-2094-${String(index + 1).padStart(6, "0")}`, clientRequestId: randomUUID(),
    summary: `Performance Ticket ${index}`, description: "Lab 4 performance-smoke fixture",
    requesterId: ids[index % 2 ? 0 : 3], categoryId: category.id, relatedSystemId: system.id,
    requestedPriority: priorities[index % 3], itPriority: priorities[index % 3], status: statuses[index % 8],
    ownerId: ["CLOSED", "CANCELLED"].includes(statuses[index % 8]) || index % 3 === 0 ? null : ids[1 + index % 2],
    resolvedAt: ["RESOLVED", "CLOSED"].includes(statuses[index % 8]) ? new Date(now - (index % 10) * 86400000 - 1) : null,
    updatedAt: new Date(now - index * 1000),
  })) });
  const tickets = await db.ticket.findMany({ orderBy: { id: "asc" }, select: { id: true, status: true } });
  const actions: Prisma.ActionTakenCreateManyInput[] = [];
  for (const [index, ticket] of tickets.entries()) for (let line = 0; line < 5; line++) {
    const completed = ["RESOLVED", "CLOSED"].includes(ticket.status) || line === 2;
    const cancelled = ticket.status === "CANCELLED" || line === 3;
    const status = cancelled ? "CANCELLED" : completed ? "COMPLETED" : line % 2 ? "IN_PROGRESS" : "PLANNED";
    const assigneeId = ids[1 + (index + line) % 2];
    actions.push({ ticketId: ticket.id, clientRequestId: randomUUID(), createFingerprint: "f".repeat(64),
      description: `Performance Action ${index}/${line}`, recordedById: ids[1 + index % 2], assigneeId,
      status, revision: cancelled ? 2 : completed ? 3 : status === "IN_PROGRESS" ? 2 : 1,
      result: completed && !cancelled ? "Verified service recovery" : null,
      performedById: completed && !cancelled ? assigneeId : null,
      completedAt: completed && !cancelled ? new Date(now - 500) : null,
      cancelledAt: cancelled ? new Date(now - 500) : null,
      cancelledById: cancelled ? ids[1] : null, cancellationSource: cancelled ? "STAFF_ACTION" : null,
      createdAt: new Date(now - 1000), updatedAt: new Date(now - 500),
    });
  }
  await db.actionTaken.createMany({ data: actions });
  // Keep lifecycle-aligned audit history instead of inventing terminal creation events.
  const events: Prisma.ActionEventCreateManyInput[] = [];
  for (const action of await db.actionTaken.findMany()) {
    events.push({ actionId: action.id, actorId: action.recordedById, eventType: "ACTION_CREATED", toStatus: "PLANNED", revision: 1, changedFields: { fields: ["description", "assigneeId"] }, createdAt: action.createdAt });
    if (action.status === "CANCELLED") events.push({ actionId: action.id, actorId: action.cancelledById!, eventType: "ACTION_CANCELLED", fromStatus: "PLANNED", toStatus: "CANCELLED", revision: 2, changedFields: { fields: ["status"] }, createdAt: action.cancelledAt! });
    else if (action.status !== "PLANNED") {
      events.push({ actionId: action.id, actorId: action.assigneeId, eventType: "ACTION_UPDATED", fromStatus: "PLANNED", toStatus: "IN_PROGRESS", revision: 2, changedFields: { fields: ["status"] }, createdAt: new Date(now - 750) });
      if (action.status === "COMPLETED") events.push({ actionId: action.id, actorId: action.performedById!, eventType: "ACTION_COMPLETED", fromStatus: "IN_PROGRESS", toStatus: "COMPLETED", revision: 3, changedFields: { fields: ["status", "result", "performedById"] }, createdAt: action.completedAt! });
    }
  }
  for (let offset = 0; offset < events.length; offset += 1000) await db.actionEvent.createMany({ data: events.slice(offset, offset + 1000) });
  await db.$executeRawUnsafe('ANALYZE "Ticket"');
  await db.$executeRawUnsafe('ANALYZE "ActionTaken"');
  for (const id of ids.slice(0, 3)) cookies.push(await cookieForUser(db, id));
}, 60000);

afterAll(async () => {
  await db.$disconnect();
  if (created) await admin.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
  await admin.$disconnect();
});

it("PERF-01 authenticated dashboards meet p95 <=500 ms on exactly 1,000 Tickets / 5,000 Actions", async () => {
  expect(await db.ticket.count()).toBe(1000);
  expect(await db.actionTaken.count()).toBe(5000);
  const results = [];
  for (const [actor, endpoint] of ["/api/dashboard/requester", "/api/staff/dashboard", "/api/staff/dashboard"].entries()) {
    const durations: number[] = [];
    for (let index = 0; index < warmup + sampleCount; index++) {
      const start = performance.now();
      const response = await request(app).get(endpoint).set("Cookie", cookies[actor]);
      const duration = performance.now() - start;
      expect(response.status).toBe(200);
      for (const list of ["recentlyUpdated", actor === 0 ? "recentlyResolved" : "urgentTickets", ...(actor === 0 ? [] : ["myActions"])]) expect(response.body[list].length).toBeLessThanOrEqual(5);
      if (index >= warmup) durations.push(duration);
    }
    const sorted = [...durations].sort((a, b) => a - b);
    const p95Ms = sorted[Math.ceil(sampleCount * 0.95) - 1];
    results.push({ role: ["REQUESTER", "IT_STAFF", "ADMINISTRATOR"][actor], endpoint, p95Ms, maxMs: sorted.at(-1), durationsMs: durations });
  }
  const report = { capturedAt: new Date().toISOString(), fixtureSchema: schema, tickets: 1000, actions: 5000,
    events: await db.actionEvent.count(), warmup, sampleCount, concurrency: 1, thresholdMs,
    measurement: "Supertest HTTP round trip including session lookup, backend database queries and JSON serialization; excludes fixture setup, browser rendering and WAN latency", node: process.version, platform: process.platform, results };
  const output = resolve(process.env.LAB4_PERFORMANCE_OUTPUT ?? "../artifacts/lab-04/issue-59/dashboard-performance.json");
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify(report, null, 2) + "\n");
  console.info("PERF-01", JSON.stringify(results.map(({ role, p95Ms, maxMs }) => ({ role, p95Ms, maxMs }))));
  for (const result of results) expect(result.p95Ms, `${result.role} p95`).toBeLessThanOrEqual(thresholdMs);
}, 60000);
