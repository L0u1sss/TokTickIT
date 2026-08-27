import { describe, expect, it } from "vitest";
import { ApiError } from "../../src/errors.js";
import { parseTicketCreateBody } from "../../src/ticket-contract.js";

const validBody = {
  clientRequestId: "c5404d4c-0b9b-4c52-9f3a-24872db6996f",
  categoryId: 3,
  relatedSystemId: 8,
  summary: "External monitor flickers",
  requestedPriority: "HIGH",
  description: "The monitor flickers after the laptop wakes from sleep.",
};

function expectValidationDetail(body: unknown, field: string) {
  try {
    parseTicketCreateBody(body);
    throw new Error("Expected validation to fail");
  } catch (error) {
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 400, code: "VALIDATION_ERROR" });
    expect((error as ApiError).details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field })]),
    );
  }
}

describe("Create Ticket validation", () => {
  it("trims valid text and accepts every documented priority", () => {
    for (const requestedPriority of ["LOW", "MEDIUM", "HIGH"] as const) {
      expect(
        parseTicketCreateBody({
          ...validBody,
          requestedPriority,
          summary: "  Valid summary  ",
          description: "  Valid ticket description  ",
        }),
      ).toEqual({
        ...validBody,
        requestedPriority,
        summary: "Valid summary",
        description: "Valid ticket description",
      });
    }
  });

  it("accepts exact Summary and Description boundaries", () => {
    expect(
      parseTicketCreateBody({
        ...validBody,
        summary: "12345",
        description: "1234567890",
      }),
    ).toMatchObject({ summary: "12345", description: "1234567890" });

    expect(
      parseTicketCreateBody({
        ...validBody,
        summary: "s".repeat(120),
        description: "d".repeat(2000),
      }),
    ).toMatchObject({
      summary: "s".repeat(120),
      description: "d".repeat(2000),
    });
  });

  it("counts Unicode code points instead of UTF-16 code units", () => {
    expect(
      parseTicketCreateBody({
        ...validBody,
        summary: "🙂🙂🙂🙂🙂",
        description: "🙂".repeat(10),
      }),
    ).toMatchObject({
      summary: "🙂🙂🙂🙂🙂",
      description: "🙂".repeat(10),
    });
  });

  it.each([
    [null, "body"],
    [[], "body"],
    [{ ...validBody, summary: "1234" }, "summary"],
    [{ ...validBody, summary: "s".repeat(121) }, "summary"],
    [{ ...validBody, description: "123456789" }, "description"],
    [{ ...validBody, description: "d".repeat(2001) }, "description"],
    [{ ...validBody, categoryId: 0 }, "categoryId"],
    [{ ...validBody, relatedSystemId: 1.5 }, "relatedSystemId"],
    [{ ...validBody, requestedPriority: "CRITICAL" }, "requestedPriority"],
    [{ ...validBody, requestedPriority: "low" }, "requestedPriority"],
    [{ ...validBody, clientRequestId: "not-a-uuid" }, "clientRequestId"],
    [{ ...validBody, requesterId: 99 }, "requesterId"],
    [{ ...validBody, ticketNumber: "TKT-2026-000001" }, "ticketNumber"],
    [{ ...validBody, status: "NEW" }, "status"],
  ])("rejects invalid input %#", (body, field) => {
    expectValidationDetail(body, field);
  });
});
