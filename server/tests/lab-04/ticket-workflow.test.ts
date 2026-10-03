import { Status } from "@prisma/client";
import { expect, it } from "vitest";
import { permittedNextStatuses, permittedStatusTransition } from "../../src/staff-ticket-operations.js";

// Expected behavior comes from the Sprint 4 contract, independently of the service matrix.
const allowed: Record<Status, readonly Status[]> = {
  NEW: ["OPEN", "CANCELLED"],
  OPEN: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  IN_PROGRESS: ["WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  WAITING_FOR_REQUESTER: ["IN_PROGRESS", "RESOLVED", "CANCELLED"],
  RESOLVED: ["REOPENED", "CLOSED"],
  CLOSED: ["REOPENED"],
  REOPENED: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  CANCELLED: ["REOPENED"],
};

it.each(Object.values(Status).flatMap(from => Object.values(Status).map(to => [from, to] as const)))("UT-03 final Ticket matrix %s -> %s agrees with the exposed next-status controls", (from, to) => {
    const permitted = allowed[from].includes(to);
    expect(permittedStatusTransition(from, to)).toBe(permitted);
    expect(permittedNextStatuses(from).includes(to)).toBe(permitted);
  });
