import type { Priority } from "@prisma/client";
import type { TicketCreateInput } from "./ticket-contract.js";

export interface StoredLogicalTicket {
  requesterId: number;
  categoryId: number;
  relatedSystemId: number;
  summary: string;
  requestedPriority: Priority;
  description: string;
}

export function isReplayCompatible(
  ticket: StoredLogicalTicket,
  requesterId: number,
  input: TicketCreateInput,
): boolean {
  return (
    ticket.requesterId === requesterId &&
    ticket.categoryId === input.categoryId &&
    ticket.relatedSystemId === input.relatedSystemId &&
    ticket.summary === input.summary &&
    ticket.requestedPriority === input.requestedPriority &&
    ticket.description === input.description
  );
}
