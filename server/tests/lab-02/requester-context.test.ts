import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../../src/app.js";
// Lab 3 intentionally rejects the Lab 2 identity header as authentication.
describe("retired requester context cannot authenticate", () => {
  it.each(["/api/tickets", "/api/tickets/1", "/api/tickets/1/attachments/1/download", "/api/metadata", "/api/categories"])("protects %s", async path => {
    const result = await request(app).get(path).set("x-requester-id", "1");
    expect(result.status).toBe(401);
    expect(result.body.error.code).toBe("AUTHENTICATION_REQUIRED");
  });
  it.each(["/api/tickets", "/api/tickets/1/attachments"])("rejects unauthenticated mutation %s before parsing", async path => {
    const result = await request(app).post(path).set("x-requester-id", "1").set("Content-Type", "application/json").send("{");
    expect(result.status).toBe(401);
  });
});
