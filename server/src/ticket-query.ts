import type { Priority, Status } from "@prisma/client";
import { invalidQueryError, type ErrorDetail } from "./errors.js";

export type TicketSortField = "createdAt" | "ticketNumber" | "summary";
export type TicketSortOrder = "asc" | "desc";

export interface TicketListQuery {
  search: string | null;
  status: Status | null;
  requestedPriority: Priority | null;
  categoryId: number | null;
  relatedSystemId: number | null;
  sortBy: TicketSortField;
  sortOrder: TicketSortOrder;
  page: number;
  pageSize: 10 | 20 | 50;
}

const allowedFields = new Set([
  "search",
  "status",
  "requestedPriority",
  "categoryId",
  "relatedSystemId",
  "sortBy",
  "sortOrder",
  "page",
  "pageSize",
]);
const priorities = new Set<Priority>(["LOW", "MEDIUM", "HIGH"]);
const sortFields = new Set<TicketSortField>([
  "createdAt",
  "ticketNumber",
  "summary",
]);
const sortOrders = new Set<TicketSortOrder>(["asc", "desc"]);
const pageSizes = new Set([10, 20, 50]);

function singleString(
  record: Record<string, unknown>,
  field: string,
  details: ErrorDetail[],
): string | undefined {
  const value = record[field];
  if (value === undefined) return undefined;
  if (typeof value !== "string") {
    details.push({ field, issue: "Must be supplied at most once as text." });
    return undefined;
  }
  return value;
}

function positiveInteger(
  value: string | undefined,
  field: string,
  defaultValue: number | null,
  details: ErrorDetail[],
): number | null {
  if (value === undefined) return defaultValue;
  if (!/^[1-9]\d*$/.test(value)) {
    details.push({ field, issue: "Must be a positive integer." });
    return defaultValue;
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    details.push({ field, issue: "Must be a positive safe integer." });
    return defaultValue;
  }
  return parsed;
}

export function parseTicketListQuery(
  query: Record<string, unknown>,
): TicketListQuery {
  const details: ErrorDetail[] = [];
  for (const field of Object.keys(query)) {
    if (!allowedFields.has(field)) {
      details.push({ field, issue: "Unsupported query parameter." });
    }
  }

  const rawSearch = singleString(query, "search", details);
  const normalizedSearch = rawSearch?.trim() ?? "";
  if (Array.from(normalizedSearch).length > 120) {
    details.push({ field: "search", issue: "Must contain at most 120 characters." });
  }

  const rawStatus = singleString(query, "status", details);
  if (rawStatus !== undefined && rawStatus !== "New") {
    details.push({ field: "status", issue: "Must be New." });
  }

  const rawPriority = singleString(query, "requestedPriority", details);
  if (
    rawPriority !== undefined &&
    !priorities.has(rawPriority as Priority)
  ) {
    details.push({
      field: "requestedPriority",
      issue: "Must be LOW, MEDIUM, or HIGH.",
    });
  }

  const rawSortBy = singleString(query, "sortBy", details);
  if (rawSortBy !== undefined && !sortFields.has(rawSortBy as TicketSortField)) {
    details.push({
      field: "sortBy",
      issue: "Must be createdAt, ticketNumber, or summary.",
    });
  }
  const rawSortOrder = singleString(query, "sortOrder", details);
  if (
    rawSortOrder !== undefined &&
    !sortOrders.has(rawSortOrder as TicketSortOrder)
  ) {
    details.push({ field: "sortOrder", issue: "Must be asc or desc." });
  }

  const categoryId = positiveInteger(
    singleString(query, "categoryId", details),
    "categoryId",
    null,
    details,
  );
  const relatedSystemId = positiveInteger(
    singleString(query, "relatedSystemId", details),
    "relatedSystemId",
    null,
    details,
  );
  const page = positiveInteger(
    singleString(query, "page", details),
    "page",
    1,
    details,
  ) as number;
  const parsedPageSize = positiveInteger(
    singleString(query, "pageSize", details),
    "pageSize",
    10,
    details,
  ) as number;
  if (!pageSizes.has(parsedPageSize)) {
    details.push({ field: "pageSize", issue: "Must be 10, 20, or 50." });
  }

  if (details.length > 0) throw invalidQueryError(details);

  return {
    search: normalizedSearch || null,
    status: rawStatus === "New" ? "NEW" : null,
    requestedPriority: (rawPriority as Priority | undefined) ?? null,
    categoryId,
    relatedSystemId,
    sortBy: (rawSortBy as TicketSortField | undefined) ?? "createdAt",
    sortOrder: (rawSortOrder as TicketSortOrder | undefined) ?? "desc",
    page,
    pageSize: parsedPageSize as 10 | 20 | 50,
  };
}
