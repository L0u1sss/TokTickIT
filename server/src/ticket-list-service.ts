import { Prisma, type PrismaClient, type Status } from "@prisma/client";
import type { RequesterContext } from "./requester-context.js";
import type { TicketListQuery } from "./ticket-query.js";

const ticketSummarySelection = Prisma.validator<Prisma.TicketSelect>()({
  id: true,
  ticketNumber: true,
  summary: true,
  requestedPriority: true,
  status: true,
  category: { select: { id: true, name: true } },
  relatedSystem: { select: { id: true, name: true } },
  _count: {
    select: { attachments: { where: { removedAt: null } } },
  },
  createdAt: true,
  updatedAt: true,
});

type TicketSummaryRow = Prisma.TicketGetPayload<{
  select: typeof ticketSummarySelection;
}>;

function publicStatus(status: Status): "New" {
  if (status !== "NEW") throw new Error("Unsupported ticket status");
  return "New";
}

function serializeTicketSummary(ticket: TicketSummaryRow) {
  return {
    id: ticket.id,
    ticketNumber: ticket.ticketNumber,
    summary: ticket.summary,
    requestedPriority: ticket.requestedPriority,
    status: publicStatus(ticket.status),
    category: ticket.category,
    relatedSystem: ticket.relatedSystem,
    activeAttachmentCount: ticket._count.attachments,
    createdAt: ticket.createdAt.toISOString(),
    updatedAt: ticket.updatedAt.toISOString(),
  };
}

export async function listTickets(
  prisma: PrismaClient,
  requester: RequesterContext,
  query: TicketListQuery,
) {
  const where: Prisma.TicketWhereInput = {
    requesterId: requester.id,
    ...(query.search
      ? {
          OR: [
            { ticketNumber: { contains: query.search, mode: "insensitive" } },
            { summary: { contains: query.search, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.requestedPriority
      ? { requestedPriority: query.requestedPriority }
      : {}),
    ...(query.categoryId ? { categoryId: query.categoryId } : {}),
    ...(query.relatedSystemId
      ? { relatedSystemId: query.relatedSystemId }
      : {}),
  };
  const orderBy = [
    { [query.sortBy]: query.sortOrder },
    { id: query.sortOrder },
  ] as Prisma.TicketOrderByWithRelationInput[];

  const [rows, totalItems] = await Promise.all([
    prisma.ticket.findMany({
      where,
      select: ticketSummarySelection,
      orderBy,
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.ticket.count({ where }),
  ]);

  return {
    items: rows.map(serializeTicketSummary),
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      totalItems,
      totalPages: totalItems === 0 ? 0 : Math.ceil(totalItems / query.pageSize),
    },
    sort: { by: query.sortBy, order: query.sortOrder },
    filters: {
      search: query.search,
      status: query.status ? "New" : null,
      requestedPriority: query.requestedPriority,
      categoryId: query.categoryId,
      relatedSystemId: query.relatedSystemId,
    },
  };
}
