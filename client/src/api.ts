const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export const REQUESTER_HEADER_NAME = "x-requester-id";
export const INVALID_REQUESTER_CONTEXT_CODE = "INVALID_REQUESTER_CONTEXT";

export interface Category {
  id: number;
  name: string;
}

export interface RelatedSystem {
  id: number;
  name: string;
}

export interface TicketMetadata {
  categories: Category[];
  relatedSystems: RelatedSystem[];
}

export type RequestedPriority = "LOW" | "MEDIUM" | "HIGH";

export interface TicketCreateInput {
  clientRequestId: string;
  categoryId: number;
  relatedSystemId: number;
  summary: string;
  requestedPriority: RequestedPriority;
  description: string;
}

export interface TicketDetail {
  id: number;
  ticketNumber: string;
  summary: string;
  description: string;
  requestedPriority: RequestedPriority;
  status: "New";
  requester: Requester;
  category: Category;
  relatedSystem: RelatedSystem;
  activeAttachmentCount: number;
  attachments: unknown[];
  createdAt: string;
  updatedAt: string;
}

export interface TicketSummary {
  id: number;
  ticketNumber: string;
  summary: string;
  requestedPriority: RequestedPriority;
  status: "New";
  category: Category;
  relatedSystem: RelatedSystem;
  activeAttachmentCount: number;
  createdAt: string;
  updatedAt: string;
}

export type TicketSortField = "createdAt" | "ticketNumber" | "summary";
export type TicketSortOrder = "asc" | "desc";

export interface TicketListQuery {
  search?: string;
  status?: "New";
  requestedPriority?: RequestedPriority;
  categoryId?: number;
  relatedSystemId?: number;
  sortBy: TicketSortField;
  sortOrder: TicketSortOrder;
  page: number;
  pageSize: 10 | 20 | 50;
}

export interface TicketListResponse {
  items: TicketSummary[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
  sort: { by: TicketSortField; order: TicketSortOrder };
  filters: {
    search: string | null;
    status: "New" | null;
    requestedPriority: RequestedPriority | null;
    categoryId: number | null;
    relatedSystemId: number | null;
  };
}

export interface TicketCreateResult {
  ticket: TicketDetail;
  replayed: boolean;
}

export interface SystemStatus {
  online: boolean;
  categories: Category[];
}

export interface Requester {
  id: number;
  displayName: string;
  email: string;
}

export interface ApiErrorDetail {
  field: string;
  issue: string;
}

interface ApiErrorEnvelope {
  error?: {
    code?: unknown;
    message?: unknown;
    details?: unknown;
  };
}

export class ApiResponseError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: ApiErrorDetail[];

  constructor(
    status: number,
    code: string,
    message: string,
    details: ApiErrorDetail[] = [],
  ) {
    super(message);
    this.name = "ApiResponseError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export class InvalidRequesterContextError extends Error {
  readonly response: Response;

  constructor(response: Response) {
    super("The selected requester is no longer available");
    this.name = "InvalidRequesterContextError";
    this.response = response;
  }
}

function resolveApiUrl(input: string | URL): string | URL {
  if (typeof input !== "string" || !input.startsWith("/")) {
    return input;
  }

  return `${API_URL}${input}`;
}

async function hasInvalidRequesterContext(response: Response): Promise<boolean> {
  if (response.status !== 400) {
    return false;
  }

  try {
    const body = (await response.clone().json()) as ApiErrorEnvelope;
    return body.error?.code === INVALID_REQUESTER_CONTEXT_CODE;
  } catch {
    return false;
  }
}

/**
 * Sends a protected API request for a previously validated requester.
 * The response body remains available to the caller when the API returns an
 * error. INVALID_REQUESTER_CONTEXT is surfaced as a typed error so the context
 * provider can clear the simulated identity without retrying the request.
 */
export async function fetchWithRequester(
  input: string | URL,
  requesterId: number,
  init: RequestInit = {},
): Promise<Response> {
  if (!Number.isSafeInteger(requesterId) || requesterId <= 0) {
    throw new TypeError("requesterId must be a positive safe integer");
  }

  const headers = new Headers(init.headers);
  headers.set(REQUESTER_HEADER_NAME, String(requesterId));

  const response = await fetch(resolveApiUrl(input), {
    ...init,
    headers,
  });

  if (await hasInvalidRequesterContext(response)) {
    throw new InvalidRequesterContextError(response);
  }

  return response;
}

// ---------------------------------------------------------------------------
// Issue 2 — Health check only
// ---------------------------------------------------------------------------
export async function checkHealth(): Promise<{ online: boolean }> {
  const healthRes = await fetch(`${API_URL}/api/health`);
  if (!healthRes.ok) {
    throw new Error("Backend health check failed");
  }
  return { online: true };
}

// Issue 2 + Issue 4 — call the backend.
// Fetch `${API_URL}/api/health`; if not ok, throw.
// Then fetch `${API_URL}/api/categories`; if not ok, throw.
// Return { online: true, categories }.
// Throwing on failure lets the UI show a single Offline/error state.
export async function checkSystem(): Promise<SystemStatus> {
  await checkHealth();

  const categoriesRes = await fetch(`${API_URL}/api/categories`);
  if (!categoriesRes.ok) {
    throw new Error(`Categories request failed with status ${categoriesRes.status}`);
  }

  const categories: Category[] = await categoriesRes.json();
  return { online: true, categories };
}

export async function getRequesters(): Promise<Requester[]> {
  const response = await fetch(`${API_URL}/api/requesters`);

  if (!response.ok) {
    throw new Error(`Unable to load requesters (status ${response.status})`);
  }

  return (await response.json()) as Requester[];
}

function isApiErrorDetail(value: unknown): value is ApiErrorDetail {
  if (!value || typeof value !== "object") return false;
  const detail = value as Record<string, unknown>;
  return typeof detail.field === "string" && typeof detail.issue === "string";
}

async function apiResponseError(response: Response): Promise<ApiResponseError> {
  try {
    const envelope = (await response.json()) as ApiErrorEnvelope;
    const code =
      typeof envelope.error?.code === "string"
        ? envelope.error.code
        : "UNKNOWN_ERROR";
    const message =
      typeof envelope.error?.message === "string"
        ? envelope.error.message
        : "The request could not be completed.";
    const details = Array.isArray(envelope.error?.details)
      ? envelope.error.details.filter(isApiErrorDetail)
      : [];
    return new ApiResponseError(response.status, code, message, details);
  } catch {
    return new ApiResponseError(
      response.status,
      "UNKNOWN_ERROR",
      "The request could not be completed.",
    );
  }
}

export async function getTicketMetadata(signal?: AbortSignal): Promise<TicketMetadata> {
  const response = await fetch(`${API_URL}/api/metadata`, { signal });
  if (!response.ok) {
    throw await apiResponseError(response);
  }
  return (await response.json()) as TicketMetadata;
}

export type RequestAsCurrentRequester = (
  input: string | URL,
  init?: RequestInit,
) => Promise<Response>;

export async function createTicket(
  requestAsCurrentRequester: RequestAsCurrentRequester,
  input: TicketCreateInput,
): Promise<TicketCreateResult> {
  const response = await requestAsCurrentRequester("/api/tickets", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw await apiResponseError(response);
  }

  return (await response.json()) as TicketCreateResult;
}

export async function getTickets(
  requestAsCurrentRequester: RequestAsCurrentRequester,
  query: TicketListQuery,
  signal?: AbortSignal,
): Promise<TicketListResponse> {
  const parameters = new URLSearchParams();
  if (query.search) parameters.set("search", query.search);
  if (query.status) parameters.set("status", query.status);
  if (query.requestedPriority) {
    parameters.set("requestedPriority", query.requestedPriority);
  }
  if (query.categoryId) parameters.set("categoryId", String(query.categoryId));
  if (query.relatedSystemId) {
    parameters.set("relatedSystemId", String(query.relatedSystemId));
  }
  parameters.set("sortBy", query.sortBy);
  parameters.set("sortOrder", query.sortOrder);
  parameters.set("page", String(query.page));
  parameters.set("pageSize", String(query.pageSize));

  const response = await requestAsCurrentRequester(
    `/api/tickets?${parameters.toString()}`,
    { signal },
  );
  if (!response.ok) throw await apiResponseError(response);
  return (await response.json()) as TicketListResponse;
}

