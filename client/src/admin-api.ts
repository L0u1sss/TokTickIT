import { AuthError, type AuthUser } from "./auth-api.js";
export interface ManagedUser extends AuthUser { isActive: boolean; createdAt: string; updatedAt: string }
export async function adminRequest<T>(path: string, method = "GET", body?: unknown, signal?: AbortSignal): Promise<T> {
  const token = document.cookie.split(";").map(value => value.trim()).find(value => value.startsWith("toktickit_csrf="))?.slice(15);
  const response = await fetch(`${import.meta.env.VITE_API_URL ?? "http://localhost:3000"}/api/admin/${path}`, {
    method, credentials: "include", cache: "no-store", signal,
    ...(body === undefined ? {} : { headers: { "Content-Type": "application/json", ...(token ? { "X-CSRF-Token": token } : {}) }, body: JSON.stringify(body) }),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new AuthError(response.status, data.error?.code ?? "INTERNAL_ERROR", response.status >= 500 ? "The request could not be completed. Try again." : data.error?.message ?? "The request could not be completed. Try again.", data.error?.fieldErrors);
  }
  return response.json() as Promise<T>;
}
