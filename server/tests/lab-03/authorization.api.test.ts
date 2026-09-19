import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PrismaClient, type UserRole } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";
import { cookieForUser } from "../session-fixture.js";

const db = new PrismaClient();
vi.mock("../../src/prisma.js", () => ({ getPrisma: () => db }));
import { app } from "../../src/app.js";
const marker = randomUUID();
const ids: number[] = [];
const cookies: Record<string, string> = {};
let categoryId: number, relatedSystemId: number, ticketId: number;
let storage: string;
const origin = "http://localhost:5173";
const body = () => ({ clientRequestId: randomUUID(), summary: "Session-owned ticket", description: "Requester session ownership regression", requestedPriority: "HIGH", categoryId, relatedSystemId });

beforeAll(async () => {
  vi.stubEnv("CLIENT_ORIGIN", origin);
  storage = await mkdtemp(join(tmpdir(), "toktickit-authz-")); vi.stubEnv("ATTACHMENT_STORAGE_DIR", storage);
  for (const [index, role] of (["REQUESTER", "REQUESTER", "IT_STAFF", "ADMINISTRATOR"] as UserRole[]).entries()) {
    const user = await db.user.create({ data: { displayName: "Authorization User", email: `${index}-${marker}@authz.test`, passwordHash: "test-locked", role, mustChangePassword: false } });
    ids.push(user.id); cookies[index] = await cookieForUser(db, user.id);
  }
  categoryId = (await db.category.create({ data: { name: `Authz ${marker}` } })).id;
  relatedSystemId = (await db.relatedSystem.create({ data: { name: `Authz ${marker}` } })).id;
});
afterAll(async () => {
  await db.attachment.deleteMany({ where: { ticket: { requesterId: { in: ids } } } });
  await db.ticket.deleteMany({ where: { requesterId: { in: ids } } });
  await db.session.deleteMany({ where: { userId: { in: ids } } });
  await db.user.deleteMany({ where: { id: { in: ids } } });
  if (categoryId) await db.category.delete({ where: { id: categoryId } });
  if (relatedSystemId) await db.relatedSystem.delete({ where: { id: relatedSystemId } });
  if (storage) await rm(storage, { recursive: true, force: true });
  vi.unstubAllEnvs(); await db.$disconnect();
});

describe("Issue #31 authenticated Requester cutover", () => {
  it("creates/replays under session ownership and rejects protected body fields", async () => {
    const input = body();
    const create = () => request(app).post("/api/tickets").set("Cookie", cookies[0]).set("Origin", origin).set("x-requester-id", String(ids[1])).send(input);
    const result = await create(); expect(result.status).toBe(201);
    ticketId = result.body.ticket.id; expect(result.body.ticket.requester.id).toBe(ids[0]);
    expect((await create()).status).toBe(200);
    expect((await request(app).post("/api/tickets").set("Cookie", cookies[0]).set("Origin", origin).send({ ...input, summary: "Changed payload" })).status).toBe(409);
    expect((await request(app).post("/api/tickets").set("Cookie", cookies[0]).set("Origin", origin).send({ ...body(), requesterId: ids[1] })).status).toBe(400);
  });
  it("lists/details only the session owner despite forged headers", async () => {
    const own = await request(app).get("/api/tickets").set("Cookie", cookies[0]).set("x-requester-id", String(ids[1]));
    expect(own.status).toBe(200); expect(own.body.items.map((x: { id: number }) => x.id)).toContain(ticketId);
    const other = await request(app).get("/api/tickets").set("Cookie", cookies[1]).set("x-requester-id", String(ids[0]));
    expect(other.body.items).toEqual([]);
    expect((await request(app).get(`/api/tickets/${ticketId}`).set("Cookie", cookies[0])).status).toBe(200);
    expect((await request(app).get(`/api/tickets/${ticketId}`).set("Cookie", cookies[1])).status).toBe(404);
    expect((await request(app).get("/api/tickets/2147483647").set("Cookie", cookies[0])).status).toBe(404);
  });
  it("keeps upload/download/removal ownership and audit actors session-derived", async () => {
    const upload = await request(app).post(`/api/tickets/${ticketId}/attachments`).set("Cookie", cookies[0]).set("Origin", origin)
      .set("x-requester-id", String(ids[1])).attach("file", Buffer.from("%PDF-1.4\nTest"), { filename: "test.pdf", contentType: "application/pdf" });
    expect(upload.status).toBe(201); const attId = upload.body.id;
    expect((await db.attachment.findUniqueOrThrow({ where: { id: attId } })).uploadedByRequesterId).toBe(ids[0]);
    const path = `/api/tickets/${ticketId}/attachments/${attId}`;
    expect((await request(app).get(`${path}/download`).set("Cookie", cookies[1])).status).toBe(404);
    expect((await request(app).get(`${path}/download`).set("Cookie", cookies[0])).status).toBe(200);
    expect((await request(app).patch(`${path}/remove`).set("Cookie", cookies[1]).set("Origin", origin).send({ reason: "Not mine" })).status).toBe(404);
    expect((await request(app).patch(`${path}/remove`).set("Cookie", cookies[0]).set("Origin", origin).send({ reason: "Replaced file" })).status).toBe(200);
    expect((await db.attachment.findUniqueOrThrow({ where: { id: attId } })).removedByRequesterId).toBe(ids[0]);
  });
  it.each([2, 3])("blocks non-Requester %s before Ticket lookup or mutation", async index => {
    for (const path of ["/api/tickets", `/api/tickets/${ticketId}`, `/api/tickets/${ticketId}/attachments/1/download`, "/api/metadata"]) {
      expect((await request(app).get(path).set("Cookie", cookies[index])).status).toBe(403);
    }
    expect((await request(app).post("/api/tickets").set("Cookie", cookies[index]).set("Origin", origin).send(body())).status).toBe(403);
  });
  it("guards staff/admin namespaces and retires account enumeration", async () => {
    expect((await request(app).get("/api/staff/tickets").set("Cookie", cookies[0])).status).toBe(403);
    expect((await request(app).get("/api/admin/users").set("Cookie", cookies[2])).status).toBe(403);
    expect((await request(app).get("/api/staff/tickets").set("Cookie", cookies[2])).status).toBe(200);
    expect((await request(app).get("/api/admin/users").set("Cookie", cookies[3])).status).toBe(200);
    expect((await request(app).get("/api/requesters").set("Cookie", cookies[0])).status).toBe(404);
  });
  it("requires Origin before parsing authenticated mutations", async () => {
    const response = await request(app).post("/api/tickets").set("Cookie", cookies[0]).set("Content-Type", "application/json").send("{");
    expect(response.status).toBe(403); expect(response.body.error.code).toBe("ORIGIN_NOT_ALLOWED");
  });
  it("revalidates role, mandatory password and activation on every request", async () => {
    await db.user.update({ where: { id: ids[1] }, data: { mustChangePassword: true } });
    expect((await request(app).get("/api/tickets").set("Cookie", cookies[1])).body.error.code).toBe("PASSWORD_CHANGE_REQUIRED");
    await db.user.update({ where: { id: ids[1] }, data: { mustChangePassword: false, role: "IT_STAFF" } });
    expect((await request(app).get("/api/tickets").set("Cookie", cookies[1])).status).toBe(403);
    await db.user.update({ where: { id: ids[1] }, data: { isActive: false } });
    expect((await request(app).get("/api/tickets").set("Cookie", cookies[1])).status).toBe(401);
  });
  it("rejects a logged-out cookie on actual Ticket APIs", async () => {
    expect((await request(app).post("/api/auth/logout").set("Cookie", cookies[0]).set("Origin", origin)).status).toBe(204);
    expect((await request(app).get("/api/tickets").set("Cookie", cookies[0])).status).toBe(401);
  });
});
