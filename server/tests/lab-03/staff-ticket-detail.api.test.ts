import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { PrismaClient, Status } from "@prisma/client";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { cookieForUser } from "../session-fixture.js";
import { localAttachmentStorage } from "../../src/attachment-storage.js";

const db = new PrismaClient();
vi.mock("../../src/prisma.js", () => ({ getPrisma: () => db }));
import { app } from "../../src/app.js";
const marker = randomUUID(), csrf = "a".repeat(43);
const ids: number[] = [], cookies: string[] = [];
let ticketId: number, categoryId: number, systemId: number, attachmentId: number;
const bytes = Buffer.from("%PDF-1.4\nLab 2 attachment continuity\n%%EOF");
let storageKey: string;
const url = (suffix = "", id = ticketId) => `/api/staff/tickets/${id}${suffix}`;
const read = (suffix = "", actor = 1) => request(app).get(url(suffix)).set("Cookie", cookies[actor]);
const write = (suffix: string, body: object = {}, actor = 1, id = ticketId) => request(app)[suffix === "/claim" ? "post" : "patch"](url(suffix, id))
  .set("Cookie", `${cookies[actor]}; toktickit_csrf=${csrf}`).set("X-CSRF-Token", csrf).set("Origin", "http://localhost:5173").send(body);

beforeAll(async () => {
  for (const [index, role] of (["REQUESTER", "IT_STAFF", "ADMINISTRATOR", "IT_STAFF"] as const).entries()) {
    const user = await db.user.create({ data: { displayName: `Detail ${index}`, email: `${marker}-${index}@example.test`, role, isActive: index !== 3, passwordHash: "locked", mustChangePassword: false } });
    ids.push(user.id); cookies.push(await cookieForUser(db, user.id));
  }
  categoryId = (await db.category.create({ data: { name: marker } })).id;
  systemId = (await db.relatedSystem.create({ data: { name: marker } })).id;
  ticketId = (await db.ticket.create({ data: { ticketNumber: `TKT-2094-${String(ids[0]).padStart(6, "0")}`, clientRequestId: randomUUID(), summary: "Staff evidence", description: "Existing requester ticket", requestedPriority: "HIGH", itPriority: "HIGH", requesterId: ids[0], categoryId, relatedSystemId: systemId } })).id;
  storageKey = await localAttachmentStorage.write(bytes);
  attachmentId = (await db.attachment.create({ data: { ticketId, originalName: "existing.pdf", mimeType: "application/pdf", sizeBytes: bytes.length, storageKey, uploadedByRequesterId: ids[0] } })).id;
});
beforeEach(async () => {
  await db.ticket.update({ where: { id: ticketId }, data: { status: "NEW", ownerId: null, lastOwnerId: null, itPriority: "HIGH" } });
  await db.attachment.update({ where: { id: attachmentId }, data: { removedAt: null, removalReason: null, removedByRequesterId: null } });
});
afterEach(() => vi.restoreAllMocks());
afterAll(async () => {
  await db.attachment.deleteMany({ where: { ticketId } });
  await db.ticket.deleteMany({ where: { id: ticketId } });
  await db.session.deleteMany({ where: { userId: { in: ids } } });
  await db.user.deleteMany({ where: { id: { in: ids } } });
  await db.category.delete({ where: { id: categoryId } });
  await db.relatedSystem.delete({ where: { id: systemId } });
  if (storageKey) await localAttachmentStorage.delete(storageKey);
  await db.$disconnect();
});

it.each([1, 2])("returns safe detail and original attachment bytes to permitted actor %s", async actor => {
  const detail = await read("", actor);
  expect(detail.status).toBe(200);
  expect(detail.body).toMatchObject({ id: ticketId, requester: { id: ids[0] }, requestedPriority: "HIGH", attachments: [{ id: attachmentId, fileName: "existing.pdf", downloadable: true }] });
  expect(JSON.stringify(detail.body)).not.toMatch(/passwordHash|tokenHash|storageKey|internalNotes/);
  const download = await read(`/attachments/${attachmentId}/download`, actor);
  expect(download.status).toBe(200); expect(download.body).toEqual(bytes);
  expect(download.headers["content-disposition"]).toContain('attachment; filename="existing.pdf"');
  expect(download.headers["x-content-type-options"]).toBe("nosniff");
});
it("enforces direct API authorization on every operation and hides resource existence", async () => {
  for (const id of [ticketId, 2147483647]) {
    expect((await request(app).get(url("", id))).status).toBe(401);
    expect((await request(app).get(url("", id)).set("Cookie", cookies[0])).status).toBe(403);
    for (const suffix of ["/claim", "/owner", "/it-priority", "/status"]) expect((await write(suffix, {}, 0, id)).status).toBe(403);
    expect((await request(app).get(url(`/attachments/${attachmentId}/download`, id)).set("Cookie", cookies[0])).status).toBe(403);
  }
  expect((await read("", 3)).status).toBe(401);
  expect((await request(app).get(url("", 2147483647)).set("Cookie", cookies[1])).status).toBe(404);
  expect((await request(app).post(url("/claim")).set("Cookie", cookies[1]).set("Origin", "http://localhost:5173").send({})).status).toBe(403);
});
it("allows exactly one concurrent claim and preserves that owner on conflict", async () => {
  const results = await Promise.all([write("/claim", {}, 1), write("/claim", {}, 2)]);
  expect(results.map(result => result.status).sort()).toEqual([200, 409]);
  const winner = results.find(result => result.status === 200)!;
  expect((await db.ticket.findUniqueOrThrow({ where: { id: ticketId } })).ownerId).toBe(winner.body.owner.id);
  expect(results.find(result => result.status === 409)!.body.error.code).toBe("TICKET_ALREADY_ASSIGNED");
});
it("reassigns to active staff/admin and rejects inactive/requester/missing owners", async () => {
  for (const ownerId of [ids[1], ids[2]]) {
    const result = await write("/owner", { ownerId });
    expect(result.status).toBe(200); expect(result.body.owner.id).toBe(ownerId);
  }
  for (const ownerId of [ids[0], ids[3], 2147483647]) {
    const result = await write("/owner", { ownerId });
    expect(result.status).toBe(409); expect(result.body.error.code).toBe("INVALID_ASSIGNEE");
  }
  expect((await db.ticket.findUniqueOrThrow({ where: { id: ticketId } })).ownerId).toBe(ids[2]);
});
it.each(["CLOSED", "CANCELLED"] as const)("rejects claim and reassign of %s", async status => {
  await db.ticket.update({ where: { id: ticketId }, data: { status } });
  for (const suffix of ["/claim", "/owner"]) expect((await write(suffix, { ownerId: ids[1] })).body.error.code).toBe("TICKET_NOT_ASSIGNABLE");
});
it("updates IT Priority without changing Requested Priority", async () => {
  for (const itPriority of ["LOW", "MEDIUM", "HIGH"]) {
    expect((await write("/it-priority", { itPriority })).status).toBe(200);
    expect(await db.ticket.findUniqueOrThrow({ where: { id: ticketId } })).toMatchObject({ requestedPriority: "HIGH", itPriority });
  }
});

// Independent expectation from the approved transition matrix, not the production helper.
const allowed: Record<Status, Status[]> = {
  NEW: ["OPEN", "CANCELLED"], OPEN: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  IN_PROGRESS: ["WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"], WAITING_FOR_REQUESTER: ["IN_PROGRESS", "RESOLVED", "CANCELLED"],
  RESOLVED: ["REOPENED", "CLOSED"], REOPENED: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  CLOSED: ["REOPENED"], CANCELLED: ["REOPENED"],
};
it.each(Object.values(Status).flatMap(from => Object.values(Status).map(to => [from, to] as const)))("enforces %s -> %s and persists ownership correctly", async (from, to) => {
  await db.ticket.update({ where: { id: ticketId }, data: { status: from, ownerId: ids[1] } });
  const valid = allowed[from].includes(to), terminal = to === "CLOSED" || to === "CANCELLED";
  const result = await write("/status", { status: to });
  expect(result.status).toBe(valid ? 200 : 409);
  if (!valid) expect(result.body.error.code).toBe("INVALID_STATUS_TRANSITION");
  expect(await db.ticket.findUniqueOrThrow({ where: { id: ticketId } })).toMatchObject({ status: valid ? to : from, ownerId: valid && terminal ? null : ids[1], lastOwnerId: valid && terminal ? ids[1] : null });
});
it("rejects malformed operations and missing tickets safely", async () => {
  for (const [suffix, body] of [["/owner", { ownerId: "1" }], ["/owner", { ownerId: 0 }], ["/it-priority", { itPriority: "URGENT" }], ["/status", { status: "DONE" }]] as const) expect((await write(suffix, body)).status).toBe(400);
  for (const [suffix, body] of [["/claim", {}], ["/owner", { ownerId: ids[1] }], ["/it-priority", { itPriority: "LOW" }], ["/status", { status: "OPEN" }]] as const) expect((await write(suffix, body, 1, 2147483647)).status).toBe(404);
});
it("denies removed, missing and wrong-ticket attachments without disclosing storage", async () => {
  expect((await read("/attachments/2147483647/download")).status).toBe(404);
  expect((await request(app).get(url(`/attachments/${attachmentId}/download`, 2147483647)).set("Cookie", cookies[1])).status).toBe(404);
  await db.attachment.update({ where: { id: attachmentId }, data: { removedAt: new Date(), removalReason: "No longer needed", removedByRequesterId: ids[0] } });
  expect((await read(`/attachments/${attachmentId}/download`)).status).toBe(404);
  expect((await read()).body.attachments[0]).toMatchObject({ isRemoved: true, downloadable: false });
});
it("redacts unexpected storage and database failures", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.spyOn(localAttachmentStorage, "read").mockRejectedValueOnce(new Error("private storage secret"));
  const download = await read(`/attachments/${attachmentId}/download`);
  expect(download.status).toBe(500); expect(JSON.stringify(download.body)).not.toContain("private storage");
  vi.spyOn(db.ticket, "findUnique").mockRejectedValueOnce(new Error("database password secret"));
  const detail = await read();
  expect(detail.status).toBe(500); expect(detail.body.error.code).toBe("INTERNAL_ERROR");
  expect(JSON.stringify(detail.body)).not.toContain("database password");
  expect(detail.body.error.requestId).toBe(detail.headers["x-request-id"]);
  expect(log).toHaveBeenCalledWith("Request failed", detail.body.error.requestId);
  expect(JSON.stringify(log.mock.calls)).not.toMatch(/database password|private storage/);
});
