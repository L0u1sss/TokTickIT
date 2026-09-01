import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

const prismaMocks = vi.hoisted(() => ({
  findMany: vi.fn(),
}));

vi.mock("../../src/prisma.js", () => ({
  getPrisma: () => ({
    requesterUser: {
      findMany: prismaMocks.findMany,
    },
  }),
}));

import { app } from "../../src/app.js";

type StoredRequester = {
  id: number;
  displayName: string;
  email: string;
  isActive: boolean;
};

const expectedQuery = {
  where: { isActive: true },
  select: { id: true, displayName: true, email: true },
  orderBy: [{ displayName: "asc" }, { id: "asc" }],
};

function mockRequesterStore(rows: StoredRequester[]) {
  prismaMocks.findMany.mockImplementation(async (query: typeof expectedQuery) => {
    let result = [...rows];

    if (query.where?.isActive !== undefined) {
      result = result.filter(
        (requester) => requester.isActive === query.where.isActive,
      );
    }

    if (query.orderBy) {
      result.sort(
        (left, right) =>
          left.displayName.localeCompare(right.displayName) || left.id - right.id,
      );
    }

    return result.map(({ id, displayName, email }) => ({
      id,
      displayName,
      email,
    }));
  });
}

describe("GET /api/requesters", () => {
  beforeEach(() => {
    prismaMocks.findMany.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 JSON with only active requesters in the public response shape", async () => {
    mockRequesterStore([
      {
        id: 3,
        displayName: "Sarah Johnson",
        email: "sarah.j@example.com",
        isActive: true,
      },
      {
        id: 5,
        displayName: "Inactive User",
        email: "inactive.user@example.com",
        isActive: false,
      },
      {
        id: 1,
        displayName: "Jennifer Anderson",
        email: "jennifer.a@example.com",
        isActive: true,
      },
      {
        id: 2,
        displayName: "Michael Brown",
        email: "michael.b@example.com",
        isActive: true,
      },
    ]);

    const response = await request(app).get("/api/requesters");

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toMatch(/application\/json/);
    expect(response.body).toEqual([
      {
        id: 1,
        displayName: "Jennifer Anderson",
        email: "jennifer.a@example.com",
      },
      {
        id: 2,
        displayName: "Michael Brown",
        email: "michael.b@example.com",
      },
      {
        id: 3,
        displayName: "Sarah Johnson",
        email: "sarah.j@example.com",
      },
    ]);
    expect(response.body).not.toContainEqual(
      expect.objectContaining({ email: "inactive.user@example.com" }),
    );
    expect(prismaMocks.findMany).toHaveBeenCalledOnce();
    expect(prismaMocks.findMany).toHaveBeenCalledWith(expectedQuery);
  });

  it("uses displayName and then id for deterministic ascending order", async () => {
    mockRequesterStore([
      {
        id: 8,
        displayName: "Alex Kim",
        email: "alex.8@example.com",
        isActive: true,
      },
      {
        id: 4,
        displayName: "Alex Kim",
        email: "alex.4@example.com",
        isActive: true,
      },
    ]);

    const response = await request(app).get("/api/requesters");

    expect(response.body.map((requester: { id: number }) => requester.id)).toEqual([
      4, 8,
    ]);
    expect(prismaMocks.findMany).toHaveBeenCalledWith(expectedQuery);
  });

  it("returns an empty array when there are no active requesters", async () => {
    mockRequesterStore([
      {
        id: 5,
        displayName: "Inactive User",
        email: "inactive.user@example.com",
        isActive: false,
      },
    ]);

    const response = await request(app).get("/api/requesters");

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  it("ignores requester headers and query parameters", async () => {
    prismaMocks.findMany.mockResolvedValue([
      {
        id: 1,
        displayName: "Jennifer Anderson",
        email: "jennifer.a@example.com",
      },
    ]);

    const response = await request(app)
      .get("/api/requesters?isActive=false&requesterId=999")
      .set("x-requester-id", "999");

    expect(response.status).toBe(200);
    expect(prismaMocks.findMany).toHaveBeenCalledWith(expectedQuery);
    expect(response.body).toEqual([
      {
        id: 1,
        displayName: "Jennifer Anderson",
        email: "jennifer.a@example.com",
      },
    ]);
  });

  it("returns a safe 500 response when Prisma fails", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    prismaMocks.findMany.mockRejectedValue(
      new Error("postgres://admin:secret@database/internal"),
    );

    const response = await request(app).get("/api/requesters");

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      error: {
        code: "INTERNAL_ERROR",
        message: "The request could not be completed.",
      },
    });
    expect(response.text).not.toContain("secret");
    expect(consoleError).toHaveBeenCalledOnce();
  });
});
