import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { PrismaClient, type Status } from "@prisma/client";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { cookieForUser } from "../session-fixture.js";
const db = new PrismaClient();
vi.mock("../../src/prisma.js", () => ({ getPrisma: () => db }));
import { app } from "../../src/app.js";
const ids: number[] = [], cookies: string[] = [];
let ticketId: number, categoryId: number, relatedSystemId: number;
const marker = randomUUID(), csrf = "a".repeat(43);
beforeAll(async () => {
  for (const [index, role] of (["REQUESTER", "IT_STAFF", "ADMINISTRATOR", "REQUESTER"] as const).entries()) {
    const user = await db.user.create({ data: { displayName: `Communication ${index}`, email: `${marker}-${index}@example.test`, role, passwordHash: "locked", mustChangePassword: false } });
    ids.push(user.id); cookies.push(await cookieForUser(db, user.id));
  }
  categoryId = (await db.category.create({ data: { name: marker } })).id;
  relatedSystemId = (await db.relatedSystem.create({ data: { name: marker } })).id;
  ticketId = (await db.ticket.create({ data: { ticketNumber: `TKT-2095-${String(ids[0]).padStart(6, "0")}`, clientRequestId: randomUUID(), summary: "Communication", description: "Test communication", requestedPriority: "HIGH", itPriority: "HIGH", requesterId: ids[0], categoryId, relatedSystemId } })).id;
});
afterAll(async () => {
  await db.publicComment.deleteMany({ where: { ticketId } }); await db.internalNote.deleteMany({ where: { ticketId } });
  await db.ticket.deleteMany({ where: { id: ticketId } });
  await db.session.deleteMany({ where: { userId: { in: ids } } }); await db.user.deleteMany({ where: { id: { in: ids } } });
  await db.category.delete({ where: { id: categoryId } }); await db.relatedSystem.delete({ where: { id: relatedSystemId } }); await db.$disconnect();
});
const path = (actor: number, suffix: string) => `/api/${actor === 1 || actor === 2 ? "staff/" : ""}tickets/${ticketId}/${suffix}`;
const post = (actor: number, suffix: string, body: object = {}) => request(app).post(path(actor, suffix)).set("Cookie", `${cookies[actor]}; toktickit_csrf=${csrf}`).set("X-CSRF-Token", csrf).set("Origin", "http://localhost:5173").send(body);
it.each([0, 1, 2])("creates and lists public text with server identity for role %s", async actor => {
  const result = await post(actor, "comments", { content: " <img src=x onerror=alert(1)> " });
  expect(result.status).toBe(201); expect(result.body.author.id).toBe(ids[actor]); expect(result.body.author.passwordHash).toBeUndefined();
  expect(result.body.content).toBe("<img src=x onerror=alert(1)>"); expect(Number.isNaN(Date.parse(result.body.createdAt))).toBe(false);
  const list = await request(app).get(path(actor, "comments")).set("Cookie", cookies[actor]);
  expect(list.status).toBe(200); expect(list.body.items.some((x: { id: number }) => x.id === result.body.id)).toBe(true);
});
it.each([1, 2])("allows private notes only in staff endpoints for role %s", async actor => {
  expect((await post(actor, "internal-notes", { content: "Secret operational note" })).status).toBe(201);
  const notes = await request(app).get(path(actor, "internal-notes")).set("Cookie", cookies[actor]);
  expect(notes.status).toBe(200); expect(notes.body.items.length).toBeGreaterThan(0);
  const detail = await request(app).get(`/api/tickets/${ticketId}`).set("Cookie", cookies[0]);
  expect(detail.status).toBe(200); expect(JSON.stringify(detail.body)).not.toContain("Secret operational note"); expect(detail.body.internalNotes).toBeUndefined();
  const staffDetail = await request(app).get(`/api/staff/tickets/${ticketId}`).set("Cookie", cookies[actor]);
  expect(staffDetail.body.internalNotes).toBeUndefined();
});
it("blocks requester direct note APIs before disclosing existence, and foreign tickets", async () => {
  for (const id of [ticketId, 2147483647]) {
    expect((await request(app).get(`/api/staff/tickets/${id}/internal-notes`).set("Cookie", cookies[0])).status).toBe(403);
    expect((await request(app).post(`/api/staff/tickets/${id}/internal-notes`).set("Cookie", cookies[0]).set("Origin", "http://localhost:5173").send({ content: "x" })).status).toBe(403);
  }
  expect((await post(3, "comments", { content: "x" })).status).toBe(404);
  expect((await post(3, "problem-appears-resolved")).status).toBe(404);
});
it.each([0, 1, 2])("rejects bad content and forged metadata, exposes no edit/delete for %s", async actor => {
  for (const suffix of actor === 0 ? ["comments"] : ["comments", "internal-notes"]) {
    for (const body of [{ content: "  " }, { content: "x".repeat(2001) }, { content: "x", authorId: ids[actor] }, { content: "x", createdAt: "2020" }]) expect((await post(actor, suffix, body)).status).toBe(400);
    expect((await post(actor, suffix, { content: "😀".repeat(2000) })).status).toBe(201);
    for (const method of ["patch", "delete"] as const) expect((await request(app)[method](`${path(actor, suffix)}/1`).set("Cookie", `${cookies[actor]}; toktickit_csrf=${csrf}`).set("X-CSRF-Token", csrf).set("Origin", "http://localhost:5173").send({ content: "replacement" })).status).toBe(404);
  }
});
it.each(["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "REOPENED"] as Status[])("records idempotent indication without changing %s", async status => {
  await db.ticket.update({ where: { id: ticketId }, data: { status, problemAppearsResolvedAt: null, problemAppearsResolvedById: null } });
  const first = await post(0, "problem-appears-resolved"), second = await post(0, "problem-appears-resolved");
  expect(first.status).toBe(200); expect(second.body).toEqual(first.body); expect(first.body.problemAppearsResolvedBy.id).toBe(ids[0]);
  expect((await db.ticket.findUniqueOrThrow({ where: { id: ticketId } })).status).toBe(status);
});
it.each(["RESOLVED", "CLOSED", "CANCELLED"] as Status[])("rejects indication for %s and clears it when reopened", async status => {
  await db.ticket.update({ where: { id: ticketId }, data: { status } });
  expect((await post(0, "problem-appears-resolved")).status).toBe(409);
  const expectedUpdatedAt = (await db.ticket.findUniqueOrThrow({ where: { id: ticketId }, select: { updatedAt: true } })).updatedAt.toISOString();
  const reopened = await request(app).patch(path(1, "status")).set("Cookie", `${cookies[1]}; toktickit_csrf=${csrf}`).set("X-CSRF-Token", csrf).set("Origin", "http://localhost:5173").send({ status: "REOPENED", expectedUpdatedAt });
  expect(reopened.status).toBe(200);
  expect((await db.ticket.findUniqueOrThrow({ where: { id: ticketId } })).problemAppearsResolvedAt).toBeNull();
  expect((await post(0, "problem-appears-resolved")).status).toBe(200);
});
it("rejects requester attempts to formally resolve/close and missing CSRF", async () => {
  for (const status of ["RESOLVED", "CLOSED"]) expect((await request(app).patch(path(0, "status")).set("Cookie", cookies[0]).set("Origin", "http://localhost:5173").send({ status })).status).toBe(404);
  expect((await request(app).post(path(1, "comments")).set("Cookie", cookies[1]).set("Origin", "http://localhost:5173").send({ content: "x" })).status).toBe(403);
});

function expectCommunicationDto(value: unknown) {
  expect(value).toEqual({
    id: expect.any(Number), content: expect.any(String), createdAt: expect.any(String),
    author: { id: expect.any(Number), displayName: expect.any(String), role: expect.stringMatching(/^(REQUESTER|IT_STAFF|ADMINISTRATOR)$/) },
  });
}
it.each([0, 1, 2])("returns the exact communication DTO for actor %s", async actor => {
  for (const suffix of actor === 0 ? ["comments"] : ["comments", "internal-notes"]) {
    const created = await post(actor, suffix, { content: "Exact DTO" });
    expect(created.status).toBe(201); expectCommunicationDto(created.body);
    const listed = await request(app).get(path(actor, suffix)).set("Cookie", cookies[actor]);
    expect(listed.status).toBe(200);
    expect(listed.body.items.length).toBeGreaterThan(0);
    listed.body.items.forEach(expectCommunicationDto);
  }
  if (actor !== 0) {
    const detail = await request(app).get('/api/staff/tickets/' + ticketId).set("Cookie", cookies[actor]);
    expect(detail.status).toBe(200);
    expect(detail.body.publicComments.length).toBeGreaterThan(0);
    detail.body.publicComments.forEach(expectCommunicationDto);
  }
});
it.each([0, 1, 2, 3])("checks resource access before invalid body for actor %s", async actor => {
  const suffixes = actor === 1 || actor === 2 ? ["comments", "internal-notes"] : ["comments", "problem-appears-resolved"];
  for (const suffix of suffixes) {
    for (const id of [ticketId, 2147483647]) {
      const result = await request(app).post(path(actor, suffix).replace('/' + ticketId + '/', '/' + id + '/'))
        .set("Cookie", cookies[actor] + '; toktickit_csrf=' + csrf).set("X-CSRF-Token", csrf)
        .set("Origin", "http://localhost:5173").send({ unexpected: "invalid" });
      const inaccessible = actor === 3 || id !== ticketId;
      expect(result.status).toBe(inaccessible ? 404 : 400);
      expect(result.body.error.code).toBe(inaccessible ? "NOT_FOUND" : "VALIDATION_ERROR");
      if (inaccessible) expect(result.body.error.fieldErrors).toBeUndefined();
    }
  }
});
