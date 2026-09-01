import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { duplicateRequestConflict } from "../../src/errors.js";

const mocks = vi.hoisted(() => ({
  requesterFindFirst: vi.fn(),
  createTicket: vi.fn(),
}));

vi.mock("../../src/prisma.js", () => ({
  getPrisma: () => ({
    requesterUser: { findFirst: mocks.requesterFindFirst },
  }),
}));

vi.mock("../../src/ticket-service.js", () => ({
  createTicket: mocks.createTicket,
}));

import { app } from "../../src/app.js";

const body = {
  clientRequestId: "c5404d4c-0b9b-4c52-9f3a-24872db6996f",
  categoryId: 3,
  relatedSystemId: 8,
  summary: "  External monitor flickers  ",
  requestedPriority: "HIGH",
  description: "  The monitor flickers after the laptop wakes from sleep.  ",
};

const ticket = {
  id: 145,
  ticketNumber: "TKT-2026-000145",
  summary: "External monitor flickers",
  description: "The monitor flickers after the laptop wakes from sleep.",
  requestedPriority: "HIGH",
  status: "New",
  requester: {
    id: 12,
    displayName: "Mali Chantarangsu",
    email: "mali@example.com",
  },
  category: { id: 3, name: "Hardware" },
  relatedSystem: { id: 8, name: "Office Workstation" },
  activeAttachmentCount: 0,
  attachments: [],
  createdAt: "2026-08-20T07:15:30.000Z",
  updatedAt: "2026-08-20T07:15:30.000Z",
};

describe("POST /api/tickets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requesterFindFirst.mockResolvedValue(ticket.requester);
    mocks.createTicket.mockResolvedValue({
      status: 201,
      replayed: false,
      ticket,
    });
  });

  it("creates for the validated requester and returns Location", async () => {
    const response = await request(app)
      .post("/api/tickets")
      .set("x-requester-id", "12")
      .send(body);

    expect(response.status).toBe(201);
    expect(response.headers.location).toBe("/api/tickets/145");
    expect(response.body).toEqual({ ticket, replayed: false });
    expect(mocks.createTicket).toHaveBeenCalledWith(
      expect.anything(),
      ticket.requester,
      {
        ...body,
        summary: "External monitor flickers",
        description: "The monitor flickers after the laptop wakes from sleep.",
      },
    );
  });

  it("returns the original Ticket for an identical replay", async () => {
    mocks.createTicket.mockResolvedValue({ status: 200, replayed: true, ticket });
    const response = await request(app)
      .post("/api/tickets")
      .set("x-requester-id", "12")
      .send(body);
    expect(response.status).toBe(200);
    expect(response.headers.location).toBe("/api/tickets/145");
    expect(response.body).toEqual({ ticket, replayed: true });
  });

  it.each([undefined, "", "0", "-1", "1.5", "abc"])(
    "rejects invalid requester context %s",
    async (header) => {
      let operation = request(app).post("/api/tickets").send(body);
      if (header !== undefined) operation = operation.set("x-requester-id", header);
      const response = await operation;
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("INVALID_REQUESTER_CONTEXT");
      expect(mocks.createTicket).not.toHaveBeenCalled();
    },
  );

  it("rejects an unknown or inactive requester", async () => {
    mocks.requesterFindFirst.mockResolvedValue(null);
    const response = await request(app)
      .post("/api/tickets")
      .set("x-requester-id", "99")
      .send(body);
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_REQUESTER_CONTEXT");
  });

  it("returns field details and creates nothing for invalid body fields", async () => {
    const response = await request(app)
      .post("/api/tickets")
      .set("x-requester-id", "12")
      .send({ ...body, summary: "x", requestedPriority: "CRITICAL" });
    expect(response.status).toBe(400);
    expect(response.body.error).toMatchObject({
      code: "VALIDATION_ERROR",
      details: expect.arrayContaining([
        expect.objectContaining({ field: "summary" }),
        expect.objectContaining({ field: "requestedPriority" }),
      ]),
    });
    expect(mocks.createTicket).not.toHaveBeenCalled();
  });

  it("returns INVALID_JSON for malformed JSON", async () => {
    const response = await request(app)
      .post("/api/tickets")
      .set("x-requester-id", "12")
      .set("content-type", "application/json")
      .send('{"summary":');
    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: {
        code: "INVALID_JSON",
        message: "The request body must contain valid JSON.",
      },
    });
  });

  it("returns the documented conflict without exposing the original Ticket", async () => {
    mocks.createTicket.mockRejectedValue(duplicateRequestConflict());
    const response = await request(app)
      .post("/api/tickets")
      .set("x-requester-id", "12")
      .send(body);
    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      error: {
        code: "DUPLICATE_REQUEST_CONFLICT",
        message: "clientRequestId was already used for a different request.",
      },
    });
    expect(response.text).not.toContain("TKT-2026-000145");
  });

  it("returns a safe 500 when creation fails unexpectedly", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.createTicket.mockRejectedValue(
      new Error("Prisma failed using postgres://admin:secret@internal"),
    );
    const response = await request(app)
      .post("/api/tickets")
      .set("x-requester-id", "12")
      .send(body);
    expect(response.status).toBe(500);
    expect(response.body.error).toEqual({
      code: "INTERNAL_ERROR",
      message: "The request could not be completed.",
    });
    expect(response.text).not.toContain("secret");
  });
});
