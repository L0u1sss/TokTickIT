import request, { type Test } from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requesterFindFirst: vi.fn(),
}));

vi.mock("../../src/prisma.js", () => ({
  getPrisma: () => ({
    requesterUser: { findFirst: mocks.requesterFindFirst },
  }),
}));

import { app } from "../../src/app.js";

const endpoints = [
  { name: "ticket list", call: () => request(app).get("/api/tickets") },
  { name: "ticket create", call: () => request(app).post("/api/tickets").send({}) },
  { name: "ticket detail", call: () => request(app).get("/api/tickets/1") },
  {
    name: "attachment upload",
    call: () => request(app).post("/api/tickets/1/attachments"),
  },
  {
    name: "attachment download",
    call: () => request(app).get("/api/tickets/1/attachments/1/download"),
  },
  {
    name: "attachment removal",
    call: () => request(app).patch("/api/tickets/1/attachments/1/remove").send({}),
  },
] as const;

const rejectedHeaders = [
  { name: "missing", value: undefined, queriesDatabase: false },
  { name: "blank", value: " ", queriesDatabase: false },
  { name: "zero", value: "0", queriesDatabase: false },
  { name: "negative", value: "-1", queriesDatabase: false },
  { name: "decimal", value: "1.5", queriesDatabase: false },
  { name: "malformed", value: "requester-one", queriesDatabase: false },
  { name: "repeated", value: "1, 2", queriesDatabase: false },
  { name: "unknown", value: "999", queriesDatabase: true },
  { name: "inactive", value: "5", queriesDatabase: true },
] as const;

function setRequesterHeader(testRequest: Test, value: string | undefined) {
  if (value === undefined) return testRequest;
  return testRequest.set("x-requester-id", value);
}

describe.each(endpoints)("requester context on $name", ({ call }) => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requesterFindFirst.mockResolvedValue(null);
  });

  it.each(rejectedHeaders)(
    "rejects $name context before protected work",
    async ({ value, queriesDatabase }) => {
      const response = await setRequesterHeader(call(), value);

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: {
          code: "INVALID_REQUESTER_CONTEXT",
          message: "Select an active Development Requester before continuing.",
        },
      });
      expect(response.text).not.toMatch(/Prisma|postgres|credential|stack|storage/i);
      expect(mocks.requesterFindFirst).toHaveBeenCalledTimes(queriesDatabase ? 1 : 0);
    },
  );
});
