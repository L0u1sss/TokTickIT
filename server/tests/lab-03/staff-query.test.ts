import { describe, expect, it } from "vitest";
import { parseStaffQuery } from "../../src/staff-queue.js";
describe("staff queue query contract", () => {
  it("defaults to last updated descending and twenty tickets", () => {
    expect(parseStaffQuery({})).toMatchObject({ page: 1, pageSize: 20, sortBy: "updatedAt", sortOrder: "desc" });
  });
  it.each([{ status: "New" }, { page: "0" }, { page: "1.5" }, { pageSize: "101" }, { pageSize: "0" },
    { ownerId: "2147483648" }, { ownerId: "-1" }, { search: " " }, { search: "x".repeat(121) },
    { search: ["one", "two"] }, { unexpected: "value" }, { sortBy: "summary" }, { sortOrder: "DESC" },
    { itPriority: "URGENT" }, { status: { x: "NEW" } }])("rejects malformed query %j", query => {
    expect(() => parseStaffQuery(query)).toThrow(expect.objectContaining({ code: "INVALID_QUERY" }));
  });
  it("normalizes search and accepts all filters", () => {
    expect(parseStaffQuery({ search: " printer ", status: "WAITING_FOR_REQUESTER", requestedPriority: "LOW", itPriority: "HIGH", ownerId: "me", pageSize: "1" }))
      .toMatchObject({ search: "printer", status: "WAITING_FOR_REQUESTER", requestedPriority: "LOW", itPriority: "HIGH", ownerId: "me", pageSize: 1 });
  });
});
