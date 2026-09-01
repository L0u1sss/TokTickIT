import { Prisma, type PrismaClient } from "@prisma/client";
import { ApiError } from "./errors.js";
import type { RequesterContext } from "./requester-context.js";
import { serializeTicket } from "./ticket-service.js";

export const ticketDetailInclude = Prisma.validator<Prisma.TicketInclude>()({
  requester: { select: { id: true, displayName: true, email: true } },
  category: { select: { id: true, name: true } },
  relatedSystem: { select: { id: true, name: true } },
  attachments: {
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      originalName: true,
      mimeType: true,
      sizeBytes: true,
      createdAt: true,
      removedAt: true,
      removalReason: true,
    },
  },
});

export async function getOwnedTicketDetail(
  prisma: PrismaClient,
  requester: RequesterContext,
  ticketId: number,
) {
  const ownership = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { requesterId: true },
  });
  if (!ownership) {
    throw new ApiError(404, "TICKET_NOT_FOUND", "Ticket not found.");
  }
  if (ownership.requesterId !== requester.id) {
    throw new ApiError(403, "TICKET_FORBIDDEN", "You do not have access to this ticket.");
  }

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: ticketDetailInclude,
  });
  if (!ticket) {
    throw new ApiError(404, "TICKET_NOT_FOUND", "Ticket not found.");
  }
  return serializeTicket(ticket);
}
