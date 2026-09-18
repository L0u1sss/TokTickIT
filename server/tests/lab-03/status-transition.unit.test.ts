import { describe, expect, it } from "vitest";
import { permittedNextStatuses, permittedStatusTransition } from "../../src/staff-ticket-operations.js";

describe("Lab 3 staff status transitions", () => {
  it.each([
    ["CLOSED", "REOPENED"],
    ["CANCELLED", "REOPENED"],
  ] as const)("allows %s to %s", (current, next) => {
    expect(permittedStatusTransition(current, next)).toBe(true);
    expect(permittedNextStatuses(current)).toContain(next);
  });

  it.each([
    ["CLOSED", "OPEN"],
    ["CANCELLED", "IN_PROGRESS"],
  ] as const)("rejects invalid terminal transition %s to %s", (current, next) => {
    expect(permittedStatusTransition(current, next)).toBe(false);
  });
});