// Session-based role navigation replaces the Lab 2 selector/switcher tests.
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { afterEach, it, expect, vi } from "vitest";
import AuthApp from "../../src/AuthApp.js";
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it("preserves a direct My Tickets query string after session restore", async () => {
  window.history.replaceState({}, "", "/tickets?search=printer&page=2");
  vi.stubGlobal("fetch", vi.fn().mockImplementation((url: string) => Promise.resolve(new Response(JSON.stringify(
    url.endsWith("/api/auth/me") ? { user: { id: 1, displayName: "User", email: "user@example.test", role: "REQUESTER", mustChangePassword: false } }
    : { categories: [], relatedSystems: [], items: [], pagination: { page: 2, totalPages: 2, totalItems: 0 } }
  )))));
  render(<AuthApp />);
  await screen.findByRole("heading", { name: "My Tickets" });
  await waitFor(() => expect(window.location.search).toContain("search=printer"));
  expect(new URLSearchParams(window.location.search).get("page")).toBe("2");
});
it.each(["/staff/tickets", "/admin/users"])("shows Forbidden to a Requester at %s", async path => {
  window.history.replaceState({}, "", path);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ user: { id: 1, displayName: "User", email: "user@example.test", role: "REQUESTER", mustChangePassword: false } }))));
  render(<AuthApp />);
  await screen.findByRole("heading", { name: "Forbidden" });
  expect(screen.queryByRole("link", { name: "User Management" })).toBeNull();
  expect(screen.getByRole("link", { name: "Return to your home" })).toHaveAttribute("href", "/dashboard");
});
it.each(["IT_STAFF", "ADMINISTRATOR"])("redirects %s from the Requester dashboard to their current role home", async role => {
  window.history.replaceState({}, "", "/dashboard?status=OPEN_GROUP");
  const fetchMock = vi.fn().mockImplementation((url: string) => Promise.resolve(new Response(JSON.stringify(
    url.endsWith("/api/auth/me") ? { user: { id: 2, displayName: "Staff", email: "staff@example.test", role, mustChangePassword: false } }
    : { categories: [], relatedSystems: [], items: [], users: [], pagination: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 } }
  ))));
  vi.stubGlobal("fetch", fetchMock);
  render(<AuthApp />);
  await screen.findByRole("heading", { name: role === "IT_STAFF" ? "Ticket Queue" : "User Management" });
  await waitFor(() => expect(window.location.pathname).toBe(role === "IT_STAFF" ? "/staff/tickets" : "/admin/users"));
  expect(window.location.search).toBe("");
  expect(screen.queryByRole("heading", { name: "Forbidden" })).toBeNull();
  expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/api/dashboard/requester"))).toBe(false);
});
it.each(["REQUESTER", "IT_STAFF", "ADMINISTRATOR"])("shows only permitted navigation for %s", async role => {
  window.history.replaceState({}, "", "/");
  vi.stubGlobal("fetch", vi.fn().mockImplementation((url: string) => Promise.resolve(new Response(JSON.stringify(
    url.endsWith("/api/auth/me") ? { user: { id: 1, displayName: "Session User", email: "user@example.test", role, mustChangePassword: false } }
    : role === "REQUESTER" ? { metrics: { openCount: 0, waitingForRequesterCount: 0 }, recentlyUpdated: [], recentlyResolved: [], recentlyResolvedWindow: { from: "2026-09-19T10:00:00.000Z", before: "2026-09-26T10:00:00.000Z" }, generatedAt: "2026-09-26T10:00:00.000Z" }
    : { categories: [], relatedSystems: [], items: [] }
  )))));
  render(<AuthApp />);
  await screen.findByRole("button", { name: "Logout" });
  expect(screen.queryByText("Change Requester")).toBeNull();
  expect(screen.queryByRole("link", { name: "My Tickets" }) !== null).toBe(role === "REQUESTER");
  expect(screen.queryByRole("link", { name: "Ticket Queue" }) !== null).toBe(role !== "REQUESTER");
  expect(screen.queryByRole("link", { name: "User Management" }) !== null).toBe(role === "ADMINISTRATOR");
  await waitFor(() => expect(window.location.pathname).toBe(role === "REQUESTER" ? "/dashboard" : role === "IT_STAFF" ? "/staff/tickets" : "/admin/users"));
});
