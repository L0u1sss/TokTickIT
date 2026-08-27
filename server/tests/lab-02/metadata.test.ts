import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

const prismaMocks = vi.hoisted(() => ({
  categoryFindMany: vi.fn(),
  relatedSystemFindMany: vi.fn(),
}));

vi.mock("../../src/prisma.js", () => ({
  getPrisma: () => ({
    category: { findMany: prismaMocks.categoryFindMany },
    relatedSystem: { findMany: prismaMocks.relatedSystemFindMany },
  }),
}));

import { app } from "../../src/app.js";

describe("GET /api/metadata", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMocks.categoryFindMany.mockResolvedValue([]);
    prismaMocks.relatedSystemFindMany.mockResolvedValue([]);
  });

  it("returns active lookup arrays using deterministic queries", async () => {
    prismaMocks.categoryFindMany.mockResolvedValue([
      { id: 3, name: "Hardware" },
      { id: 4, name: "Software" },
    ]);
    prismaMocks.relatedSystemFindMany.mockResolvedValue([
      { id: 8, name: "Office Workstation" },
      { id: 9, name: "VPN" },
    ]);

    const response = await request(app)
      .get("/api/metadata?isActive=false")
      .set("x-requester-id", "999");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      categories: [
        { id: 3, name: "Hardware" },
        { id: 4, name: "Software" },
      ],
      relatedSystems: [
        { id: 8, name: "Office Workstation" },
        { id: 9, name: "VPN" },
      ],
    });
    const expectedQuery = {
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: [{ name: "asc" }, { id: "asc" }],
    };
    expect(prismaMocks.categoryFindMany).toHaveBeenCalledWith(expectedQuery);
    expect(prismaMocks.relatedSystemFindMany).toHaveBeenCalledWith(expectedQuery);
  });

  it("preserves independent empty arrays", async () => {
    prismaMocks.relatedSystemFindMany.mockResolvedValue([{ id: 9, name: "VPN" }]);
    const response = await request(app).get("/api/metadata");
    expect(response.body).toEqual({
      categories: [],
      relatedSystems: [{ id: 9, name: "VPN" }],
    });
  });

  it("returns a safe 500 without leaking database details", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    prismaMocks.categoryFindMany.mockRejectedValue(
      new Error("postgres://admin:secret@internal/database"),
    );
    const response = await request(app).get("/api/metadata");
    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      error: {
        code: "INTERNAL_ERROR",
        message: "The request could not be completed.",
      },
    });
    expect(response.text).not.toContain("secret");
  });
});
