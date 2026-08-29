import type { PrismaClient } from "@prisma/client";
import {
  ATTACHMENT_MAX_ACTIVE,
  validateAttachmentFile,
} from "./attachment-contract.js";
import { ApiError } from "./errors.js";
import type { RequesterContext } from "./requester-context.js";

export interface AttachmentStorage {
  write(bytes: Buffer): Promise<string>;
  read(storageKey: string): Promise<Buffer>;
  delete(storageKey: string): Promise<void>;
}

interface AttachmentPublicRow {
  id: number;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: Date;
  removedAt: Date | null;
  removalReason: string | null;
}

export function serializeAttachment(attachment: AttachmentPublicRow) {
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
}

export async function requireOwnedTicket(
  prisma: PrismaClient,
  requester: RequesterContext,
  ticketId: number,
) {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { id: true, requesterId: true },
  });
  if (!ticket) throw new ApiError(404, "TICKET_NOT_FOUND", "Ticket not found.");
  if (ticket.requesterId !== requester.id) {
    throw new ApiError(403, "TICKET_FORBIDDEN", "You do not have access to this ticket.");
  }
  return ticket;
}

export async function uploadOwnedAttachment(
  prisma: PrismaClient,
  requester: RequesterContext,
  ticketId: number,
  file: Express.Multer.File | undefined,
  storage?: AttachmentStorage,
) {
  await requireOwnedTicket(prisma, requester, ticketId);
  const validated = validateAttachmentFile(file);
  const activeCount = await prisma.attachment.count({
    where: { ticketId, removedAt: null },
  });
  if (activeCount >= ATTACHMENT_MAX_ACTIVE) {
    throw new ApiError(
      400,
      "ATTACHMENT_LIMIT_REACHED",
      "This ticket already has 5 active attachments.",
    );
  }

  const selectedStorage = storage ?? (await import("./attachment-storage.js")).localAttachmentStorage;
  const storageKey = await selectedStorage.write(validated.bytes);
  try {
    const attachment = await prisma.attachment.create({
      data: {
        ticketId,
        originalName: validated.originalName,
        storageKey,
        mimeType: validated.mimeType,
        sizeBytes: validated.sizeBytes,
        uploadedByRequesterId: requester.id,
      },
    });
    return serializeAttachment(attachment);
  } catch (error) {
    try {
      await selectedStorage.delete(storageKey);
    } catch {
      console.error("Failed to clean up attachment bytes after metadata failure");
    }
    throw error;
  }
}

export async function downloadOwnedAttachment(
  prisma: PrismaClient,
  requester: RequesterContext,
  ticketId: number,
  attachmentId: number,
  storage?: AttachmentStorage,
) {
  await requireOwnedTicket(prisma, requester, ticketId);
  const attachment = await prisma.attachment.findFirst({
    where: { id: attachmentId, ticketId },
  });
  if (!attachment) {
    throw new ApiError(404, "ATTACHMENT_NOT_FOUND", "Attachment not found.");
  }
  if (attachment.removedAt) {
    throw new ApiError(404, "ATTACHMENT_NOT_AVAILABLE", "Attachment is not available.");
  }
  const selectedStorage = storage ?? (await import("./attachment-storage.js")).localAttachmentStorage;
  const bytes = await selectedStorage.read(attachment.storageKey);
  return {
    fileName: attachment.originalName,
    mediaType: attachment.mimeType,
    sizeBytes: attachment.sizeBytes,
    bytes,
  };
}

export async function removeOwnedAttachment(
  prisma: PrismaClient,
  requester: RequesterContext,
  ticketId: number,
  attachmentId: number,
  reason: string,
) {
  await requireOwnedTicket(prisma, requester, ticketId);
  const attachment = await prisma.attachment.findFirst({
    where: { id: attachmentId, ticketId },
  });
  if (!attachment) {
    throw new ApiError(404, "ATTACHMENT_NOT_FOUND", "Attachment not found.");
  }
  if (attachment.removedAt) {
    throw new ApiError(404, "ATTACHMENT_NOT_AVAILABLE", "Attachment is not available.");
  }
  const removed = await prisma.attachment.update({
    where: { id: attachmentId },
    data: {
      removedAt: new Date(),
      removalReason: reason,
      removedByRequesterId: requester.id,
    },
  });
  return serializeAttachment(removed);
}
