import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requesterFindFirst: vi.fn(),
  ticketFindMany: vi.fn(),
  ticketCount: vi.fn(),
}));

vi.mock("../../src/prisma.js", () => ({
  getPrisma: () => ({
    requesterUser: { findFirst: mocks.requesterFindFirst },
    ticket: {
      findMany: mocks.ticketFindMany,
      count: mocks.ticketCount,
    },
  }),
}));

import { app } from "../../src/app.js";

const requester = {
  id: 12,
  displayName: "Mali Chantarangsu",
  email: "mali@example.com",
};

const ticket = {
  id: 145,
  ticketNumber: "TKT-2026-000145",
  summary: "External monitor flickers",
  requestedPriority: "HIGH",
  status: "NEW",
  category: { id: 3, name: "Hardware" },
  relatedSystem: { id: 8, name: "Office Workstation" },
  _count: { attachments: 1 },
  createdAt: new Date("2026-08-20T07:15:30.000Z"),
  updatedAt: new Date("2026-08-20T07:16:00.000Z"),
};

describe("GET /api/tickets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requesterFindFirst.mockResolvedValue(requester);
    mocks.ticketFindMany.mockResolvedValue([ticket]);
    mocks.ticketCount.mockResolvedValue(1);
  });

  it("returns only the validated Requester's Ticket summaries and scoped totals", async () => {
    const response = await request(app)
      .get("/api/tickets")
      .set("x-requester-id", "12");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      items: [
        {
          id: 145,
          ticketNumber: "TKT-2026-000145",
          summary: "External monitor flickers",
          requestedPriority: "HIGH",
          status: "New",
          category: { id: 3, name: "Hardware" },
          relatedSystem: { id: 8, name: "Office Workstation" },
          activeAttachmentCount: 1,
          createdAt: "2026-08-20T07:15:30.000Z",
          updatedAt: "2026-08-20T07:16:00.000Z",
        },
      ],
      pagination: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 },
      sort: { by: "createdAt", order: "desc" },
      filters: {
        search: null,
        status: null,
        requestedPriority: null,
        categoryId: null,
        relatedSystemId: null,
      },
    });
    expect(mocks.ticketCount).toHaveBeenCalledWith({ where: { requesterId: 12 } });
    expect(mocks.ticketFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { requesterId: 12 },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: 0,
        take: 10,
      }),
    );
    expect(JSON.stringify(response.body)).not.toMatch(/description|storageKey|attachments/);
  });

  it("combines search and filters with stable server-side sorting and pagination", async () => {
    await request(app)
      .get(
        "/api/tickets?search=%20monitor%20&status=New&requestedPriority=HIGH&categoryId=3&relatedSystemId=8&sortBy=summary&sortOrder=asc&page=2&pageSize=20",
      )
      .set("x-requester-id", "12")
      .expect(200);

    const scopedWhere = {
      requesterId: 12,
      OR: [
        { ticketNumber: { contains: "monitor", mode: "insensitive" } },
        { summary: { contains: "monitor", mode: "insensitive" } },
      ],
      status: "NEW",
      requestedPriority: "HIGH",
      categoryId: 3,
      relatedSystemId: 8,
    };
    expect(mocks.ticketCount).toHaveBeenCalledWith({ where: scopedWhere });
    expect(mocks.ticketFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: scopedWhere,
        orderBy: [{ summary: "asc" }, { id: "asc" }],
        skip: 20,
        take: 20,
      }),
    );
  });

  it("maps every documented priority, sort, and page-size value to Prisma", async () => {
    for (const requestedPriority of ["LOW", "MEDIUM", "HIGH"]) {
      await request(app)
        .get(`/api/tickets?requestedPriority=${requestedPriority}`)
        .set("x-requester-id", "12")
        .expect(200);
      expect(mocks.ticketFindMany).toHaveBeenLastCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ requestedPriority }),
        }),
      );
    }

    for (const sortBy of ["createdAt", "ticketNumber", "summary"]) {
      for (const sortOrder of ["asc", "desc"]) {
        await request(app)
          .get(`/api/tickets?sortBy=${sortBy}&sortOrder=${sortOrder}`)
          .set("x-requester-id", "12")
          .expect(200);
        expect(mocks.ticketFindMany).toHaveBeenLastCalledWith(
          expect.objectContaining({
            orderBy: [{ [sortBy]: sortOrder }, { id: sortOrder }],
          }),
        );
      }
    }

    for (const pageSize of [10, 20, 50]) {
      await request(app)
        .get(`/api/tickets?pageSize=${pageSize}`)
        .set("x-requester-id", "12")
        .expect(200);
      expect(mocks.ticketFindMany).toHaveBeenLastCalledWith(
        expect.objectContaining({ take: pageSize }),
      );
    }
  });

  it("returns an empty out-of-range page with accurate requester-scoped totals", async () => {
    mocks.ticketFindMany.mockResolvedValue([]);
    mocks.ticketCount.mockResolvedValue(12);
    const response = await request(app)
      .get("/api/tickets?page=3&pageSize=10")
      .set("x-requester-id", "12");
    expect(response.status).toBe(200);
    expect(response.body.items).toEqual([]);
    expect(response.body.pagination).toEqual({
      page: 3,
      pageSize: 10,
      totalItems: 12,
      totalPages: 2,
    });
  });

  it.each([
    "?requestedPriority=CRITICAL",
    "?status=NEW",
    "?categoryId=0",
    "?page=0",
    "?pageSize=25",
    "?sortBy=updatedAt",
    "?search=one&search=two",
    "?unknown=value",
  ])("returns INVALID_QUERY without an unrestricted fallback for %s", async (query) => {
    const response = await request(app)
      .get(`/api/tickets${query}`)
      .set("x-requester-id", "12");
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_QUERY");
    expect(mocks.ticketFindMany).not.toHaveBeenCalled();
    expect(mocks.ticketCount).not.toHaveBeenCalled();
  });

  it("rejects an unknown or inactive Requester before querying Tickets", async () => {
    mocks.requesterFindFirst.mockResolvedValue(null);
    const response = await request(app)
      .get("/api/tickets")
      .set("x-requester-id", "99");
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_REQUESTER_CONTEXT");
    expect(mocks.ticketFindMany).not.toHaveBeenCalled();
  });

  it("returns a safe 500 when the scoped list fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.ticketFindMany.mockRejectedValue(
      new Error("Prisma postgres://admin:secret@internal"),
    );
    const response = await request(app)
      .get("/api/tickets")
      .set("x-requester-id", "12");
    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      error: {
        code: "INTERNAL_ERROR",
        message: "The request could not be completed.",
      },
    });
    expect(response.text).not.toMatch(/Prisma|secret|postgres/);
  });
});
