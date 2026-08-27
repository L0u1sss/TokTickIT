import {
  Prisma,
  type PrismaClient,
  type Priority,
  type Status,
} from "@prisma/client";
import {
  duplicateRequestConflict,
  invalidReferenceError,
} from "./errors.js";
import type { RequesterContext } from "./requester-context.js";
import type { TicketCreateInput } from "./ticket-contract.js";
import { isReplayCompatible } from "./ticket-idempotency.js";
import { nextTicketNumber, ticketNumberPrefix } from "./ticket-number.js";

const ticketRelations = Prisma.validator<Prisma.TicketInclude>()({
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

type TicketWithRelations = Prisma.TicketGetPayload<{
  include: typeof ticketRelations;
}>;

export interface TicketDetailResponse {
  id: number;
  ticketNumber: string;
  summary: string;
  description: string;
  requestedPriority: Priority;
  status: "New";
  requester: RequesterContext;
  category: { id: number; name: string };
  relatedSystem: { id: number; name: string };
  activeAttachmentCount: number;
  attachments: Array<{
    id: number;
    fileName: string;
    mediaType: string;
    sizeBytes: number;
    uploadedAt: string;
    isRemoved: boolean;
    removedAt: string | null;
    removalReason: string | null;
    downloadable: boolean;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface TicketCreateResult {
  status: 200 | 201;
  replayed: boolean;
  ticket: TicketDetailResponse;
}

function publicStatus(status: Status): "New" {
  if (status !== "NEW") {
    throw new Error("Unsupported ticket status");
  }
  return "New";
}

export function serializeTicket(ticket: TicketWithRelations): TicketDetailResponse {
  const attachments = ticket.attachments.map((attachment) => {
    const isRemoved = attachment.removedAt !== null;
    return {
      id: attachment.id,
      fileName: attachment.originalName,
      mediaType: attachment.mimeType,
      sizeBytes: attachment.sizeBytes,
      uploadedAt: attachment.createdAt.toISOString(),
      isRemoved,
      removedAt: attachment.removedAt?.toISOString() ?? null,
      removalReason: attachment.removalReason,
      downloadable: !isRemoved,
    };
  });

  return {
    id: ticket.id,
    ticketNumber: ticket.ticketNumber,
    summary: ticket.summary,
    description: ticket.description,
    requestedPriority: ticket.requestedPriority,
    status: publicStatus(ticket.status),
    requester: ticket.requester,
    category: ticket.category,
    relatedSystem: ticket.relatedSystem,
    activeAttachmentCount: attachments.filter(({ isRemoved }) => !isRemoved).length,
    attachments,
    createdAt: ticket.createdAt.toISOString(),
    updatedAt: ticket.updatedAt.toISOString(),
  };
}

function replayOrConflict(
  ticket: TicketWithRelations,
  requesterId: number,
  input: TicketCreateInput,
): TicketCreateResult {
  if (!isReplayCompatible(ticket, requesterId, input)) {
    throw duplicateRequestConflict();
  }

  return { status: 200, replayed: true, ticket: serializeTicket(ticket) };
}

function isPrismaErrorCode(error: unknown, code: string): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === code
  );
}

function uniqueTargetIncludes(error: unknown, field: string): boolean {
  if (!isPrismaErrorCode(error, "P2002")) {
    return false;
  }
  const target = (error as Prisma.PrismaClientKnownRequestError).meta?.target;
  if (Array.isArray(target)) {
    return target.some((entry) => String(entry).includes(field));
  }
  return typeof target === "string" && target.includes(field);
}

async function findExisting(
  prisma: PrismaClient | Prisma.TransactionClient,
  clientRequestId: string,
): Promise<TicketWithRelations | null> {
  return prisma.ticket.findUnique({
    where: { clientRequestId },
    include: ticketRelations,
  });
}

export async function createTicket(
  prisma: PrismaClient,
  requester: RequesterContext,
  input: TicketCreateInput,
  now: () => Date = () => new Date(),
): Promise<TicketCreateResult> {
  const existing = await findExisting(prisma, input.clientRequestId);
  if (existing) {
    return replayOrConflict(existing, requester.id, input);
  }

  const attemptCreate = async (): Promise<TicketCreateResult> => {
    const createdAt = now();
    return prisma.$transaction(
      async (transaction) => {
        const winner = await findExisting(transaction, input.clientRequestId);
        if (winner) {
          return replayOrConflict(winner, requester.id, input);
        }

        const [category, relatedSystem] = await Promise.all([
          transaction.category.findFirst({
            where: { id: input.categoryId, isActive: true },
            select: { id: true },
          }),
          transaction.relatedSystem.findFirst({
            where: { id: input.relatedSystemId, isActive: true },
            select: { id: true },
          }),
        ]);

        const invalidReferences = [];
        if (!category) {
          invalidReferences.push({
            field: "categoryId",
            issue: "Must identify an active Category.",
          });
        }
        if (!relatedSystem) {
          invalidReferences.push({
            field: "relatedSystemId",
            issue: "Must identify an active Related System.",
          });
        }
        if (invalidReferences.length > 0) {
          throw invalidReferenceError(invalidReferences);
        }

        const prefix = ticketNumberPrefix(createdAt);
        const previous = await transaction.ticket.findFirst({
          where: { ticketNumber: { startsWith: prefix } },
          orderBy: { ticketNumber: "desc" },
          select: { ticketNumber: true },
        });
        const ticketNumber = nextTicketNumber(
          createdAt,
          previous?.ticketNumber ?? null,
        );

        const ticket = await transaction.ticket.create({
          data: {
            ticketNumber,
            clientRequestId: input.clientRequestId,
            summary: input.summary,
            description: input.description,
            requestedPriority: input.requestedPriority,
            status: "NEW",
            requesterId: requester.id,
            categoryId: input.categoryId,
            relatedSystemId: input.relatedSystemId,
            createdAt,
          },
          include: ticketRelations,
        });

        return { status: 201, replayed: false, ticket: serializeTicket(ticket) };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  };

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await attemptCreate();
    } catch (error) {
      if (uniqueTargetIncludes(error, "clientRequestId")) {
        const winner = await findExisting(prisma, input.clientRequestId);
        if (winner) {
          return replayOrConflict(winner, requester.id, input);
        }
      }

      const retryableNumberRace =
        uniqueTargetIncludes(error, "ticketNumber") ||
        isPrismaErrorCode(error, "P2034");
      if (retryableNumberRace && attempt < 2) {
        continue;
      }
      throw error;
    }
  }

  throw new Error("Ticket creation retry limit exceeded");
}
