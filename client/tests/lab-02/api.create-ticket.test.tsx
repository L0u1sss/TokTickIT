import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createTicket,
  getTicketMetadata,
  TicketCreateInput,
} from "../../src/api.js";

const input: TicketCreateInput = {
  clientRequestId: "c5404d4c-0b9b-4c52-9f3a-24872db6996f",
  categoryId: 3,
  relatedSystemId: 8,
  summary: "External monitor flickers",
  requestedPriority: "HIGH",
  description: "The monitor flickers after waking from sleep.",
};

describe("Create Ticket API client", () => {
  afterEach(() => vi.restoreAllMocks());

  it("loads public metadata without a requester header", async () => {
    const metadata = {
      categories: [{ id: 3, name: "Hardware" }],
      relatedSystems: [{ id: 8, name: "Office Workstation" }],
    };
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(metadata), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    await expect(getTicketMetadata()).resolves.toEqual(metadata);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3000/api/metadata",
      { signal: undefined },
    );
  });

  it("sends the exact JSON payload through requester-scoped transport", async () => {
    const requesterTransport = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ticket: { id: 1 }, replayed: false }), {
        status: 201,
        headers: { "content-type": "application/json" },
      }),
    );
    await createTicket(requesterTransport, input);
    expect(requesterTransport).toHaveBeenCalledWith("/api/tickets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
  });

  it("preserves safe status, code, and field details from an API failure", async () => {
    const requesterTransport = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            code: "VALIDATION_ERROR",
            message: "The request contains invalid fields.",
            details: [{ field: "summary", issue: "Must contain 5 characters." }],
          },
        }),
        { status: 400, headers: { "content-type": "application/json" } },
      ),
    );
    await expect(createTicket(requesterTransport, input)).rejects.toEqual(
      expect.objectContaining({
        status: 400,
        code: "VALIDATION_ERROR",
        details: [{ field: "summary", issue: "Must contain 5 characters." }],
      }),
    );
  });
});
