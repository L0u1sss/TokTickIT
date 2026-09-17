import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { useAuth } from "./AuthContext.js";
import { fetchAuthenticated } from "../api.js";

// Compatibility name for the existing Ticket components; identity is read-only
// and comes only from /auth/me, never browser storage or a selector.
export function RequesterProvider({ children }: { children: ReactNode }) { return children; }

export function useRequester() {
  const { user, refresh } = useAuth();
  const controllers = useRef(new Set<AbortController>());
  const generation = useRef(0);
  const invalidate = useCallback(() => {
    generation.current++;
    controllers.current.forEach(c => c.abort());
    controllers.current.clear();
  }, []);
  useEffect(() => {
    return invalidate;
  }, [user?.id, invalidate]);
  const requestAsCurrentRequester = useCallback(async (input: string | URL, init: RequestInit = {}) => {
    if (!user || user.role !== "REQUESTER" || user.mustChangePassword) throw new Error("An authenticated Requester is required.");
    const version = generation.current;
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (init.signal?.aborted) abort();
    else init.signal?.addEventListener("abort", abort, { once: true });
    controllers.current.add(controller);
    try {
      const response = await fetchAuthenticated(input, { ...init, signal: controller.signal });
      if (controller.signal.aborted || generation.current !== version) throw new DOMException("Session changed", "AbortError");
      if (response.status === 401 || response.status === 403) {
        const body = await response.clone().json().catch(() => null);
        if (response.status === 401 || ["PASSWORD_CHANGE_REQUIRED", "FORBIDDEN"].includes(body?.error?.code)) void refresh();
      }
      return response;
    } finally { init.signal?.removeEventListener("abort", abort); controllers.current.delete(controller); }
  }, [user, refresh]);
  return { currentRequester: user?.role === "REQUESTER" ? user : null, requestAsCurrentRequester };
}
