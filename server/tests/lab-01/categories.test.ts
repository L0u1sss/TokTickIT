import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { cookieForUser } from "../session-fixture.js";

// Issue 4 — requires the DB to be migrated and seeded first
// (npx prisma migrate dev && npx prisma db seed).
describe("GET /api/categories", () => {
  it("returns 200 and the four seeded categories in id order", async () => {
    const prisma = getPrisma();
    const user = await prisma.user.create({ data: { displayName: "Category Test", email: "category-session@example.test", role: "REQUESTER", passwordHash: "test-locked", mustChangePassword: false } });
    let res;
    try { res = await request(app).get("/api/categories").set("Cookie", await cookieForUser(prisma, user.id)); }
    finally {
      await prisma.session.deleteMany({ where: { userId: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
    }
    expect(res.status).toBe(200);

    const categories: { id: number; name: string }[] = res.body;
    expect(categories).toHaveLength(4);
    expect(categories.map((c) => c.name)).toEqual([
      "Account and Access",
      "Hardware",
      "Software",
      "Network",
    ]);

    const ids = categories.map((c) => c.id);
    expect(ids).toEqual([...ids].sort((a, b) => a - b));

    const keys = new Set(categories.flatMap((c) => Object.keys(c)));
    expect([...keys].sort()).toEqual(["id", "name"]);
  });
});
