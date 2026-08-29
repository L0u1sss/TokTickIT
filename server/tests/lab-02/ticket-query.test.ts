import { describe, expect, it } from "vitest";
import { ApiError } from "../../src/errors.js";
import { parseTicketListQuery } from "../../src/ticket-query.js";

function expectInvalid(query: Record<string, unknown>) {
  try {
    parseTicketListQuery(query);
    throw new Error("Expected query validation to fail");
  } catch (error) {
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 400, code: "INVALID_QUERY" });
  }
}

describe("My Tickets query normalization", () => {
  it("uses the documented defaults", () => {
    expect(parseTicketListQuery({})).toEqual({
      search: null,
      status: null,
      requestedPriority: null,
      categoryId: null,
      relatedSystemId: null,
      sortBy: "createdAt",
      sortOrder: "desc",
      page: 1,
      pageSize: 10,
    });
  });

  it("trims search and accepts every documented filter, sort, and page size", () => {
    for (const requestedPriority of ["LOW", "MEDIUM", "HIGH"]) {
      for (const pageSize of ["10", "20", "50"]) {
        expect(
          parseTicketListQuery({
            search: "  monitor  ",
            status: "New",
            requestedPriority,
            categoryId: "3",
            relatedSystemId: "8",
            sortBy: "summary",
            sortOrder: "asc",
            page: "2",
            pageSize,
          }),
        ).toMatchObject({
          search: "monitor",
          status: "NEW",
          requestedPriority,
          categoryId: 3,
          relatedSystemId: 8,
          sortBy: "summary",
          sortOrder: "asc",
          page: 2,
          pageSize: Number(pageSize),
        });
      }
    }
  });

  it("normalizes a blank search to no search", () => {
    expect(parseTicketListQuery({ search: "   " }).search).toBeNull();
  });

  it("counts Unicode code points at the 120-character search boundary", () => {
    const boundary = "😀".repeat(120);
    expect(parseTicketListQuery({ search: boundary }).search).toBe(boundary);
    expectInvalid({ search: `${boundary}😀` });
  });

  it("accepts every documented sort field and direction", () => {
    for (const sortBy of ["createdAt", "ticketNumber", "summary"]) {
      for (const sortOrder of ["asc", "desc"]) {
        expect(parseTicketListQuery({ sortBy, sortOrder })).toMatchObject({
          sortBy,
          sortOrder,
        });
      }
    }
  });

  it.each([
    { unknown: "value" },
    { search: ["one", "two"] },
    { requestedPriority: ["LOW", "HIGH"] },
    { search: "x".repeat(121) },
    { status: "NEW" },
    { requestedPriority: "CRITICAL" },
    { requestedPriority: "low" },
    { categoryId: "0" },
    { categoryId: "01" },
    { relatedSystemId: "1.5" },
    { sortBy: "updatedAt" },
    { sortOrder: "descending" },
    { page: "0" },
    { page: "1.5" },
    { page: ["1", "2"] },
    { pageSize: "25" },
  ])("rejects invalid query %#", (query) => {
    expectInvalid(query);
  });
});
