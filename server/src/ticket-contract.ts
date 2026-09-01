import type { Priority } from "@prisma/client";
import { validationError, type ErrorDetail } from "./errors.js";

export interface TicketCreateInput {
  clientRequestId: string;
  categoryId: number;
  relatedSystemId: number;
  summary: string;
  requestedPriority: Priority;
  description: string;
}

const allowedFields = new Set([
  "clientRequestId",
  "categoryId",
  "relatedSystemId",
  "summary",
  "requestedPriority",
  "description",
]);

const priorities = new Set<Priority>(["LOW", "MEDIUM", "HIGH"]);
const canonicalUuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validatePositiveInteger(
  value: unknown,
  field: "categoryId" | "relatedSystemId",
  label: string,
  details: ErrorDetail[],
): number | undefined {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
    details.push({ field, issue: `${label} must be a positive integer.` });
    return undefined;
  }
  return value;
}

function validateTrimmedText(
  value: unknown,
  field: "summary" | "description",
  minimum: number,
  maximum: number,
  details: ErrorDetail[],
): string | undefined {
  if (typeof value !== "string") {
    details.push({
      field,
      issue: `Must contain ${minimum} to ${maximum.toLocaleString("en-US")} characters after trimming.`,
    });
    return undefined;
  }

  const normalized = value.trim();
  const length = Array.from(normalized).length;
  if (length < minimum || length > maximum) {
    details.push({
      field,
      issue: `Must contain ${minimum} to ${maximum.toLocaleString("en-US")} characters after trimming.`,
    });
    return undefined;
  }

  return normalized;
}

export function parseTicketCreateBody(body: unknown): TicketCreateInput {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw validationError([
      { field: "body", issue: "Request body must be a JSON object." },
    ]);
  }

  const record = body as Record<string, unknown>;
  const details: ErrorDetail[] = [];
  for (const field of Object.keys(record)) {
    if (!allowedFields.has(field)) {
      details.push({ field, issue: "Unknown fields are not allowed." });
    }
  }

  const clientRequestId = record.clientRequestId;
  if (
    typeof clientRequestId !== "string" ||
    !canonicalUuidPattern.test(clientRequestId)
  ) {
    details.push({
      field: "clientRequestId",
      issue: "Must be a canonical UUID.",
    });
  }

  const categoryId = validatePositiveInteger(
    record.categoryId,
    "categoryId",
    "Category ID",
    details,
  );
  const relatedSystemId = validatePositiveInteger(
    record.relatedSystemId,
    "relatedSystemId",
    "Related System ID",
    details,
  );
  const summary = validateTrimmedText(
    record.summary,
    "summary",
    5,
    120,
    details,
  );
  const description = validateTrimmedText(
    record.description,
    "description",
    10,
    2000,
    details,
  );

  const requestedPriority = record.requestedPriority;
  if (
    typeof requestedPriority !== "string" ||
    !priorities.has(requestedPriority as Priority)
  ) {
    details.push({
      field: "requestedPriority",
      issue: "Must be LOW, MEDIUM, or HIGH.",
    });
  }

  if (details.length > 0) {
    throw validationError(details);
  }

  return {
    clientRequestId: clientRequestId as string,
    categoryId: categoryId as number,
    relatedSystemId: relatedSystemId as number,
    summary: summary as string,
    requestedPriority: requestedPriority as Priority,
    description: description as string,
  };
}
