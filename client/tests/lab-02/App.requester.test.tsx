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
  expect(screen.getByRole("link", { name: "Return to your home" })).toHaveAttribute("href", "/tickets/new");
});
it.each(["REQUESTER", "IT_STAFF", "ADMINISTRATOR"])("shows only permitted navigation for %s", async role => {
  window.history.replaceState({}, "", "/");
  vi.stubGlobal("fetch", vi.fn().mockImplementation((url: string) => Promise.resolve(new Response(JSON.stringify(
    url.endsWith("/api/auth/me") ? { user: { id: 1, displayName: "Session User", email: "user@example.test", role, mustChangePassword: false } }
    : { categories: [], relatedSystems: [], items: [] }
  )))));
  render(<AuthApp />);
  await screen.findByRole("button", { name: "Logout" });
  expect(screen.queryByText("Change Requester")).toBeNull();
  expect(screen.queryByRole("link", { name: "My Tickets" }) !== null).toBe(role === "REQUESTER");
  expect(screen.queryByRole("link", { name: "Ticket Queue" }) !== null).toBe(role !== "REQUESTER");
  expect(screen.queryByRole("link", { name: "User Management" }) !== null).toBe(role === "ADMINISTRATOR");
  await waitFor(() => expect(window.location.pathname).toBe(role === "REQUESTER" ? "/tickets/new" : role === "IT_STAFF" ? "/staff/tickets" : "/admin/users"));
});
