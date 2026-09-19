// Lab 2 selector is retired by #31; regression now proves no simulated identity entry.
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { afterEach, it, expect, vi } from "vitest";
import AuthApp from "../../src/AuthApp.js";
afterEach(() => { cleanup(); vi.unstubAllGlobals(); sessionStorage.clear(); });
it("redirects the retired selector route to Login without listing accounts", async () => {
  window.history.replaceState({}, "", "/requester-selection");
  sessionStorage.setItem("toktickit.requesterId", "123");
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: "AUTHENTICATION_REQUIRED" } }), { status: 401 }));
  vi.stubGlobal("fetch", fetchMock);
  render(<AuthApp />);
  await screen.findByRole("heading", { name: "Sign in" });
  await waitFor(() => expect(window.location.pathname).toBe("/login"));
  expect(screen.queryByRole("combobox", { name: "Development Requester" })).toBeNull();
  expect(sessionStorage.getItem("toktickit.requesterId")).toBeNull();
  expect(fetchMock.mock.calls.every(([url]) => String(url).endsWith("/api/auth/me"))).toBe(true);
});
