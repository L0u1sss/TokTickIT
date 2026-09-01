import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiResponseError, getTickets } from "../../src/api.js";

describe("My Tickets API client", () => {
  afterEach(() => vi.restoreAllMocks());

  it("serializes the complete requester-scoped list query contract", async () => {
    const controller = new AbortController();
    const requesterTransport = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [],
          pagination: { page: 2, pageSize: 20, totalItems: 0, totalPages: 0 },
          sort: { by: "summary", order: "asc" },
          filters: {},
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    await getTickets(
      requesterTransport,
      {
        search: "monitor issue",
        status: "New",
        requestedPriority: "HIGH",
        categoryId: 3,
        relatedSystemId: 8,
        sortBy: "summary",
        sortOrder: "asc",
        page: 2,
        pageSize: 20,
      },
      controller.signal,
    );

    const [path, init] = requesterTransport.mock.calls[0] as [string, RequestInit];
    expect(new URL(path, "http://client.test").searchParams).toEqual(
      new URLSearchParams({
        search: "monitor issue",
        status: "New",
        requestedPriority: "HIGH",
        categoryId: "3",
        relatedSystemId: "8",
        sortBy: "summary",
        sortOrder: "asc",
        page: "2",
        pageSize: "20",
      }),
    );
    expect(init).toEqual({ signal: controller.signal });
  });

  it("preserves only the safe API error contract", async () => {
    const requesterTransport = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            code: "INVALID_QUERY",
            message: "The query contains invalid values.",
            details: [{ field: "page", issue: "Must be a positive integer." }],
          },
        }),
        { status: 400, headers: { "content-type": "application/json" } },
      ),
    );

    await expect(
      getTickets(requesterTransport, {
        sortBy: "createdAt",
        sortOrder: "desc",
        page: 0,
        pageSize: 10,
      }),
    ).rejects.toEqual(
      new ApiResponseError(
        400,
        "INVALID_QUERY",
        "The query contains invalid values.",
        [{ field: "page", issue: "Must be a positive integer." }],
      ),
    );
  });
});
