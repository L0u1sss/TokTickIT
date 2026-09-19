import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PrismaClient, type UserRole } from "@prisma/client";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { cookieForUser } from "../session-fixture.js";
import { verifyPassword } from "../../src/password.js";
import { assignTicket, claimTicket } from "../../src/staff-ticket-operations.js";
import { updateUser } from "../../src/user-management.js";
const db = new PrismaClient();
vi.mock("../../src/prisma.js", () => ({ getPrisma: () => db }));
import { app } from "../../src/app.js";
const marker = randomUUID();
const ids: number[] = [], cookies: string[] = [];
const csrf = "a".repeat(43), password = "Initial-Password123!";
let categoryId: number, systemId: number, ticketId: number;
const write = (method: "post" | "patch", path: string, body: object, cookie = cookies[2]) => request(app)[method](path).set("Origin", "http://localhost:5173").set("Cookie", `${cookie}; toktickit_csrf=${csrf}`).set("X-CSRF-Token", csrf).send(body);
beforeAll(async () => {
  for (const role of ["REQUESTER", "IT_STAFF", "ADMINISTRATOR"] as UserRole[]) {
    const user = await db.user.create({ data: { displayName: `${role} ${marker}`, email: `${role}-${marker}@example.test`.toLowerCase(), role, passwordHash: "locked", mustChangePassword: false } });
    ids.push(user.id); cookies.push(await cookieForUser(db, user.id));
  }
  categoryId = (await db.category.create({ data: { name: marker } })).id;
  systemId = (await db.relatedSystem.create({ data: { name: marker } })).id;
  ticketId = (await db.ticket.create({ data: { ticketNumber: `TKT-2095-${String(ids[0]).padStart(6, "0")}`, clientRequestId: randomUUID(), summary: marker, description: "Preserve assignment eligibility", requesterId: ids[0], categoryId, relatedSystemId: systemId, requestedPriority: "LOW", itPriority: "LOW" } })).id;
});
afterAll(async () => {
  if (ticketId) await db.ticket.delete({ where: { id: ticketId } });
  await db.session.deleteMany({ where: { userId: { in: ids } } });
  await db.user.deleteMany({ where: { id: { in: ids } } });
  if (categoryId) await db.category.delete({ where: { id: categoryId } });
  if (systemId) await db.relatedSystem.delete({ where: { id: systemId } });
  await db.$disconnect();
});
describe("Issue #35 administrator account APIs", () => {
  it("requires authenticated Administrator and valid origin/CSRF", async () => {
    expect((await request(app).get("/api/admin/users")).status).toBe(401);
    for (const cookie of cookies.slice(0, 2)) {
      expect((await request(app).get("/api/admin/users").set("Cookie", cookie)).status).toBe(403);
      for (const [method, path] of [["post", "/api/admin/users"], ["patch", `/api/admin/users/${ids[0]}`], ["post", `/api/admin/users/${ids[0]}/initial-password`]] as const) expect((await write(method, path, {}, cookie)).status).toBe(403);
    }
    expect((await request(app).post("/api/admin/users").set("Cookie", cookies[2]).send({})).body.error.code).toBe("ORIGIN_NOT_ALLOWED");
    expect((await request(app).post("/api/admin/users").set("Cookie", cookies[2]).set("Origin", "http://localhost:5173").send({})).body.error.code).toBe("CSRF_TOKEN_INVALID");
  });
  it("lists/searches by name/email with one role and never exposes credentials", async () => {
    const response = await request(app).get(`/api/admin/users?search=${marker}&role=IT_STAFF`).set("Cookie", cookies[2]);
    expect(response.status).toBe(200); expect(response.body.items.map((user: { id: number }) => user.id)).toEqual([ids[1]]);
    expect(JSON.stringify(response.body)).not.toMatch(/passwordHash|tokenHash|sessions/);
    for (const query of ["role=OWNER", "search=", "search=a&search=b", "page=1"]) expect((await request(app).get(`/api/admin/users?${query}`).set("Cookie", cookies[2])).status).toBe(400);
  });
  it("creates hashed initial credentials, rejects normalized duplicates and invalid input", async () => {
    const data = { displayName: " New Account ", email: ` NEW-${marker}@Example.test `, role: "REQUESTER", isActive: false, initialPassword: password };
    const created = await write("post", "/api/admin/users", data);
    expect(created.status).toBe(201); ids.push(created.body.id);
    expect(created.headers.location).toBe(`/api/admin/users/${created.body.id}`);
    expect(created.body).toMatchObject({ displayName: "New Account", email: data.email.trim().toLowerCase(), isActive: false, mustChangePassword: true });
    expect(created.body.passwordHash).toBeUndefined();
    const saved = await db.user.findUniqueOrThrow({ where: { id: created.body.id } });
    expect(await verifyPassword(saved.passwordHash, password)).toBe(true);
    expect((await write("post", "/api/admin/users", data)).body.error.code).toBe("EMAIL_ALREADY_EXISTS");
    for (const extra of [{ role: ["REQUESTER", "IT_STAFF"] }, { role: "OWNER" }, { isActive: "true" }, { displayName: " " }, { email: "bad" }, { initialPassword: "weak" }, { passwordHash: "injected" }]) expect((await write("post", "/api/admin/users", { ...data, ...extra })).status).toBe(400);
  });
  it("edits accounts, prevents self deactivation, duplicate email and deletion", async () => {
    const edited = await write("patch", `/api/admin/users/${ids[3]}`, { displayName: "Renamed", role: "IT_STAFF", isActive: true });
    expect(edited.status).toBe(200); expect(edited.body).toMatchObject({ displayName: "Renamed", role: "IT_STAFF", isActive: true });
    expect((await write("patch", `/api/admin/users/${ids[2]}`, { isActive: false })).body.error.code).toBe("SELF_DEACTIVATION_NOT_ALLOWED");
    const actor = await db.user.findUniqueOrThrow({ where: { id: ids[2] } });
    expect((await write("patch", `/api/admin/users/${ids[3]}`, { email: actor.email.toUpperCase() })).body.error.code).toBe("EMAIL_ALREADY_EXISTS");
    for (const body of [{}, { initialPassword: password }, { role: null }]) expect((await write("patch", `/api/admin/users/${ids[3]}`, body)).status).toBe(400);
    expect((await write("patch", "/api/admin/users/2147483647", { isActive: false })).status).toBe(404);
    expect((await request(app).delete(`/api/admin/users/${ids[3]}`).set("Origin", "http://localhost:5173").set("Cookie", `${cookies[2]}; toktickit_csrf=${csrf}`).set("X-CSRF-Token", csrf)).status).toBe(404);
  });
  it("reset revokes sessions and requires the new initial password to be changed", async () => {
    const oldCookie = await cookieForUser(db, ids[3]);
    const reset = await write("post", `/api/admin/users/${ids[3]}/initial-password`, { initialPassword: password });
    expect(reset.status).toBe(200); expect(reset.body.user.mustChangePassword).toBe(true);
    expect((await request(app).get("/api/auth/me").set("Cookie", oldCookie)).status).toBe(401);
    const saved = await db.user.findUniqueOrThrow({ where: { id: ids[3] } });
    const login = await request(app).post("/api/auth/login").set("Origin", "http://localhost:5173").send({ email: saved.email, password });
    expect(login.status).toBe(200); expect(login.body.user.mustChangePassword).toBe(true);
    expect((await request(app).get("/api/staff/tickets").set("Cookie", login.headers["set-cookie"])).body.error.code).toBe("PASSWORD_CHANGE_REQUIRED");
  });
  it("keeps assignment eligibility under concurrent claim/reassign and account mutation", async () => {
    for (const assign of [() => claimTicket(db, ticketId, ids[1]), () => assignTicket(db, ticketId, ids[1])]) {
      await db.ticket.update({ where: { id: ticketId }, data: { ownerId: null } });
      await db.user.update({ where: { id: ids[1] }, data: { isActive: true } });
      const results = await Promise.allSettled([assign(), updateUser(db, ids[2], ids[1], { isActive: false })]);
      expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
      const owner = await db.user.findUniqueOrThrow({ where: { id: ids[1] } });
      const ticket = await db.ticket.findUniqueOrThrow({ where: { id: ticketId } });
      expect(ticket.ownerId === null || owner.isActive).toBe(true);
    }
    await db.user.update({ where: { id: ids[1] }, data: { isActive: true } });
    await db.ticket.update({ where: { id: ticketId }, data: { ownerId: ids[1] } });
    expect((await write("patch", `/api/admin/users/${ids[1]}`, { role: "REQUESTER" })).body.error.code).toBe("USER_HAS_ASSIGNED_TICKETS");
    await db.ticket.update({ where: { id: ticketId }, data: { ownerId: null, lastOwnerId: ids[1], status: "CLOSED" } });
    expect((await write("patch", `/api/admin/users/${ids[1]}`, { isActive: false })).status).toBe(200);
  });
  it("preserves the final Administrator under concurrent demotions", async () => {
    // Run only in the isolated test schema, restore every seeded account afterwards.
    const others = await db.user.findMany({ where: { role: "ADMINISTRATOR", isActive: true, id: { not: ids[2] } } });
    try {
      await db.user.updateMany({ where: { id: { in: others.map(user => user.id) } }, data: { isActive: false } });
      expect((await write("patch", `/api/admin/users/${ids[2]}`, { role: "REQUESTER" })).body.error.code).toBe("LAST_ACTIVE_ADMIN_REQUIRED");
      await db.user.update({ where: { id: ids[3] }, data: { role: "ADMINISTRATOR", isActive: true, mustChangePassword: false } });
      const results = await Promise.allSettled([updateUser(db, ids[2], ids[2], { role: "REQUESTER" }), updateUser(db, ids[3], ids[3], { role: "REQUESTER" })]);
      expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
      expect(await db.user.count({ where: { role: "ADMINISTRATOR", isActive: true } })).toBe(1);
    } finally {
      await db.user.update({ where: { id: ids[2] }, data: { role: "ADMINISTRATOR" } });
      await db.user.updateMany({ where: { id: { in: others.map(user => user.id) } }, data: { isActive: true } });
    }
  });
});
