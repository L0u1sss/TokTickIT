import { describe, expect, it } from "vitest";
import {
  nextTicketNumber,
  TICKET_NUMBER_PATTERN,
  ticketNumberPrefix,
} from "../../src/ticket-number.js";

describe("Ticket Number allocation", () => {
  const createdAt = new Date("2026-12-31T23:59:59.000Z");

  it("uses the UTC year and a zero-padded six-digit sequence", () => {
    expect(ticketNumberPrefix(createdAt)).toBe("TKT-2026-");
    expect(nextTicketNumber(createdAt, null)).toBe("TKT-2026-000001");
    expect(nextTicketNumber(createdAt, "TKT-2026-000145")).toBe(
      "TKT-2026-000146",
    );
    expect(nextTicketNumber(createdAt, null)).toMatch(TICKET_NUMBER_PATTERN);
  });

  it("uses the new UTC year at rollover", () => {
    expect(nextTicketNumber(new Date("2027-01-01T00:00:00.000Z"), null)).toBe(
      "TKT-2027-000001",
    );
  });

  it("fails safely for an unrelated previous number or exhausted year", () => {
    expect(() => nextTicketNumber(createdAt, "TKT-2025-000100")).toThrow();
    expect(() => nextTicketNumber(createdAt, "TKT-2026-999999")).toThrow();
  });
});
