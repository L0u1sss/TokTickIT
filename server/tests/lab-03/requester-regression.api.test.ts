import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";
import { cookieForUser } from "../session-fixture.js";

const db = new PrismaClient();
vi.mock("../../src/prisma.js", () => ({ getPrisma: () => db }));
import { app } from "../../src/app.js";

const users: number[] = [], cookies: string[] = [];
const marker = randomUUID(), origin = "http://localhost:5173", csrf = "r".repeat(43);
let categoryId: number, relatedSystemId: number, storage: string;
beforeAll(async () => {
  vi.stubEnv("CLIENT_ORIGIN", origin);
  storage = await mkdtemp(join(tmpdir(), "toktickit-regression-"));
  vi.stubEnv("ATTACHMENT_STORAGE_DIR", storage);
  for (let index = 0; index < 2; index++) {
    const user = await db.user.create({ data: { displayName: `Regression ${index}`, email: `${marker}-${index}@example.test`, role: "REQUESTER", passwordHash: "locked", mustChangePassword: false } });
    users.push(user.id); cookies.push(await cookieForUser(db, user.id));
  }
  categoryId = (await db.category.create({ data: { name: marker } })).id;
  relatedSystemId = (await db.relatedSystem.create({ data: { name: marker } })).id;
});
afterAll(async () => {
  const owned = { ticket: { requesterId: { in: users } } };
  await db.publicComment.deleteMany({ where: owned });
  await db.attachment.deleteMany({ where: owned });
  await db.ticket.deleteMany({ where: { requesterId: { in: users } } });
  await db.session.deleteMany({ where: { userId: { in: users } } });
  await db.user.deleteMany({ where: { id: { in: users } } });
  if (categoryId) await db.category.delete({ where: { id: categoryId } });
  if (relatedSystemId) await db.relatedSystem.delete({ where: { id: relatedSystemId } });
  if (storage) await rm(storage, { recursive: true, force: true });
  vi.unstubAllEnvs(); await db.$disconnect();
});
const headers = (actor = 0) => ({ Cookie: `${cookies[actor]}; toktickit_csrf=${csrf}`, Origin: origin, "X-CSRF-Token": csrf, "x-requester-id": String(users[1 - actor]) });

it("preserves the complete session-owned lifecycle and isolates another requester", async () => {
  const input = { clientRequestId: randomUUID(), categoryId, relatedSystemId, summary: "Requester regression lifecycle", description: "Preserve the Lab 2 workflow after authentication migration.", requestedPriority: "HIGH" };
  const created = await request(app).post("/api/tickets").set(headers()).send(input);
  expect(created.status).toBe(201);
  const id = created.body.ticket.id, path = `/api/tickets/${id}`;
  expect(created.body.ticket.requester.id).toBe(users[0]);
  expect((await request(app).post("/api/tickets").set(headers()).send(input)).body.ticket.id).toBe(id);
  expect((await request(app).get("/api/tickets").set(headers())).body.items.map((ticket: { id: number }) => ticket.id)).toEqual([id]);
  expect((await request(app).get("/api/tickets").set(headers(1))).body.items).toEqual([]);

  const bytes = Buffer.from("%PDF-1.4\nRequester regression\n%%EOF");
  const upload = await request(app).post(`${path}/attachments`).set(headers()).attach("file", bytes, { filename: "evidence.pdf", contentType: "application/pdf" });
  expect(upload.status).toBe(201);
  const attachmentPath = `${path}/attachments/${upload.body.id}`;
  const download = await request(app).get(`${attachmentPath}/download`).set(headers());
  expect(download.status).toBe(200); expect(download.body).toEqual(bytes);
  for (const target of [path, `${attachmentPath}/download`, `${path}/comments`]) {
    const denied = await request(app).get(target).set(headers(1));
    expect(denied.status).toBe(404); expect(denied.body.error.code).toBe("NOT_FOUND");
  }
  expect((await request(app).post(`${path}/attachments`).set(headers(1)).attach("file", bytes, "foreign.pdf")).status).toBe(404);
  expect((await request(app).patch(`${attachmentPath}/remove`).set(headers(1)).send({ reason: "Foreign removal" })).status).toBe(404);
  expect((await request(app).post(`${path}/comments`).set(headers(1)).send({ content: "Foreign comment" })).status).toBe(404);
  expect((await request(app).post(`${path}/problem-appears-resolved`).set(headers(1)).send({})).status).toBe(404);

  const comment = await request(app).post(`${path}/comments`).set(headers()).send({ content: "The reported issue now appears fixed." });
  expect(comment.status).toBe(201); expect(comment.body.author.id).toBe(users[0]);
  expect((await request(app).get(`${path}/comments`).set(headers())).body.items).toEqual([comment.body]);
  const indication = await request(app).post(`${path}/problem-appears-resolved`).set(headers()).send({});
  expect(indication.status).toBe(200); expect(indication.body.problemAppearsResolvedBy.id).toBe(users[0]);
  expect((await request(app).post(`${path}/problem-appears-resolved`).set(headers()).send({})).body).toEqual(indication.body);
  expect(await db.ticket.findUniqueOrThrow({ where: { id } })).toMatchObject({ status: "NEW", requesterId: users[0], itPriority: "HIGH", problemAppearsResolvedById: users[0] });
  expect((await request(app).get(path).set(headers())).status).toBe(200);
  expect((await request(app).patch(`${attachmentPath}/remove`).set(headers()).send({ reason: "Superseded evidence" })).status).toBe(200);
  expect(await db.attachment.findUniqueOrThrow({ where: { id: upload.body.id } })).toMatchObject({ uploadedByRequesterId: users[0], removedByRequesterId: users[0], removalReason: "Superseded evidence" });
  expect((await request(app).get(`${attachmentPath}/download`).set(headers())).status).toBe(404);
});

const forbidden = [
  ["get", "/api/staff/tickets"], ["get", "/api/staff/assignees"],
  ["get", "/api/staff/tickets/2147483647"],
  ["get", "/api/staff/tickets/2147483647/attachments/2147483647/download"],
  ["post", "/api/staff/tickets/2147483647/claim"],
  ["patch", "/api/staff/tickets/2147483647/owner"],
  ["patch", "/api/staff/tickets/2147483647/it-priority"],
  ["patch", "/api/staff/tickets/2147483647/status"],
  ["get", "/api/staff/tickets/2147483647/comments"],
  ["post", "/api/staff/tickets/2147483647/comments"],
  ["get", "/api/staff/tickets/2147483647/internal-notes"],
  ["post", "/api/staff/tickets/2147483647/internal-notes"],
  ["get", "/api/admin/users"], ["post", "/api/admin/users"],
  ["patch", "/api/admin/users/2147483647"],
  ["post", "/api/admin/users/2147483647/initial-password"],
] as const;
it.each(forbidden)("rejects Requester direct %s %s by role with valid CSRF", async (method, path) => {
  const response = await request(app)[method](path).set(headers()).send(method === "get" ? undefined : {});
  expect(response.status).toBe(403); expect(response.body.error.code).toBe("FORBIDDEN");
});
