import request from "supertest";
import { expect, it } from "vitest";
import { app } from "../../src/app.js";
it("does not expose the retired Development Requester list anonymously", async () => {
  const result = await request(app).get("/api/requesters");
  expect(result.status).toBe(401);
  expect(result.body).not.toBeInstanceOf(Array);
});
