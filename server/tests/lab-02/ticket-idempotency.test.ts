import { describe, expect, it } from "vitest";
import { isReplayCompatible } from "../../src/ticket-idempotency.js";

const input = {
  clientRequestId: "c5404d4c-0b9b-4c52-9f3a-24872db6996f",
  requesterId: 12,
  categoryId: 3,
  relatedSystemId: 8,
  summary: "External monitor flickers",
  requestedPriority: "HIGH" as const,
  description: "The external monitor flickers after waking from sleep.",
};

describe("Ticket create replay comparison", () => {
  it("accepts only the same requester and normalized logical payload", () => {
    expect(isReplayCompatible(input, 12, input)).toBe(true);
    expect(isReplayCompatible(input, 13, input)).toBe(false);
    expect(
      isReplayCompatible(input, 12, { ...input, summary: "Changed summary" }),
    ).toBe(false);
    expect(
      isReplayCompatible(input, 12, { ...input, requestedPriority: "LOW" }),
    ).toBe(false);
  });
});
