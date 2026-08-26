const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export const REQUESTER_HEADER_NAME = "x-requester-id";
export const INVALID_REQUESTER_CONTEXT_CODE = "INVALID_REQUESTER_CONTEXT";

export interface Category {
  id: number;
  name: string;
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

interface ApiErrorEnvelope {
  error?: {
    code?: unknown;
  };
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

