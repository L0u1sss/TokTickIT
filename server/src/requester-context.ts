import type { PrismaClient } from "@prisma/client";
import { ApiError } from "./errors.js";

export const REQUESTER_HEADER_NAME = "x-requester-id";

export interface RequesterContext {
  id: number;
  displayName: string;
  email: string;
}

export function parseRequesterId(value: string | undefined): number {
  if (!value || !/^[1-9]\d*$/.test(value)) {
    throw new ApiError(
      400,
      "INVALID_REQUESTER_CONTEXT",
      "Select an active Development Requester before continuing.",
    );
  }

  const requesterId = Number(value);
  if (!Number.isSafeInteger(requesterId)) {
    throw new ApiError(
      400,
      "INVALID_REQUESTER_CONTEXT",
      "Select an active Development Requester before continuing.",
    );
  }

  return requesterId;
}

export async function resolveRequesterContext(
  prisma: Pick<PrismaClient, "requesterUser">,
  headerValue: string | undefined,
): Promise<RequesterContext> {
  const requesterId = parseRequesterId(headerValue);
  const requester = await prisma.requesterUser.findFirst({
    where: { id: requesterId, isActive: true },
    select: { id: true, displayName: true, email: true },
  });

  if (!requester) {
    throw new ApiError(
      400,
      "INVALID_REQUESTER_CONTEXT",
      "Select an active Development Requester before continuing.",
    );
  }

  return requester;
}
