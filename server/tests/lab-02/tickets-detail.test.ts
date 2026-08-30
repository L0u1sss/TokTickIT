import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requesterFindFirst: vi.fn(),
  ticketFindUnique: vi.fn(),
}));

vi.mock("../../src/prisma.js", () => ({
  getPrisma: () => ({
    requesterUser: { findFirst: mocks.requesterFindFirst },
    ticket: { findUnique: mocks.ticketFindUnique },
  }),
}));

import { app } from "../../src/app.js";

const requester = { id: 12, displayName: "Mali Chantarangsu", email: "mali@example.com" };
const ticket = {
  id: 145,
  ticketNumber: "TKT-2026-000145",
  requesterId: 12,
  summary: "External monitor flickers",
  description: "Line one\nLine two <script>alert('no')</script>",
  requestedPriority: "HIGH",
  status: "NEW",
  requester,
  category: { id: 3, name: "Hardware" },
  relatedSystem: { id: 8, name: "Office Workstation" },
  attachments: [
    {
      id: 51,
      originalName: "monitor.jpg",
      storageKey: "private-key-active",
      mimeType: "image/jpeg",
      sizeBytes: 10,
      uploadedByRequesterId: 12,
      createdAt: new Date("2026-08-20T07:16:00.000Z"),
      removedAt: null,
      removalReason: null,
      removedByRequesterId: null,
    },
    {
      id: 52,
      originalName: "old.pdf",
      storageKey: "private-key-removed",
      mimeType: "application/pdf",
      sizeBytes: 20,
      uploadedByRequesterId: 12,
      createdAt: new Date("2026-08-20T07:17:00.000Z"),
      removedAt: new Date("2026-08-20T08:00:00.000Z"),
      removalReason: "Uploaded a clearer copy.",
      removedByRequesterId: 12,
    },
  ],
  createdAt: new Date("2026-08-20T07:15:30.000Z"),
  updatedAt: new Date("2026-08-20T07:15:30.000Z"),
};

describe("GET /api/tickets/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requesterFindFirst.mockResolvedValue(requester);
    mocks.ticketFindUnique.mockResolvedValue(ticket);
  });

  it("returns complete owned Ticket Detail and active/removed attachment metadata", async () => {
    const response = await request(app).get("/api/tickets/145").set("x-requester-id", "12");
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      id: 145,
      ticketNumber: "TKT-2026-000145",
      requestedPriority: "HIGH",
      status: "New",
      requester,
      activeAttachmentCount: 1,
      attachments: [
        { id: 51, fileName: "monitor.jpg", isRemoved: false, downloadable: true },
        {
          id: 52,
          fileName: "old.pdf",
          isRemoved: true,
          downloadable: false,
          removalReason: "Uploaded a clearer copy.",
        },
      ],
    });
    expect(response.text).not.toMatch(/storageKey|private-key|uploadedByRequesterId|removedByRequesterId/);
  });

  it.each(["0", "-1", "1.5", "abc", "9007199254740992"])(
    "returns INVALID_PATH_PARAMETER for %s",
    async (id) => {
      const response = await request(app).get(`/api/tickets/${id}`).set("x-requester-id", "12");
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("INVALID_PATH_PARAMETER");
      expect(mocks.ticketFindUnique).not.toHaveBeenCalled();
    },
  );

  it("returns 403 without protected content for a foreign Ticket", async () => {
    mocks.ticketFindUnique.mockResolvedValue({ ...ticket, requesterId: 27 });
    const response = await request(app).get("/api/tickets/145").set("x-requester-id", "12");
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("TICKET_FORBIDDEN");
    expect(response.text).not.toMatch(/TKT-2026|monitor.jpg|Line one/);
  });

  it("returns 404 for a missing Ticket", async () => {
    mocks.ticketFindUnique.mockResolvedValue(null);
    const response = await request(app).get("/api/tickets/999").set("x-requester-id", "12");
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("TICKET_NOT_FOUND");
  });

  it("returns a safe 500 for an unexpected detail failure", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.ticketFindUnique.mockRejectedValue(new Error("Prisma postgres://secret"));
    const response = await request(app).get("/api/tickets/145").set("x-requester-id", "12");
    expect(response.status).toBe(500);
    expect(response.body.error).toEqual({
      code: "INTERNAL_ERROR",
      message: "The request could not be completed.",
    });
    expect(response.text).not.toMatch(/Prisma|secret|postgres/);
  });
});
