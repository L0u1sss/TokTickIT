import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import StaffTicketQueue from "../../src/components/StaffTicketQueue.js";
const refresh = vi.fn();
vi.mock("../../src/context/AuthContext.js", () => ({ useAuth: () => ({ refresh }) }));
const person = { id: 1, displayName: "Mali", email: "mali@example.test" };
const ticket = { id: 1, ticketNumber: "TK-2026-000001", summary: "<script>printer</script>", category: { name: "Hardware" }, requester: person, owner: null,
  requestedPriority: "HIGH", itPriority: "MEDIUM", status: "OPEN", createdAt: "2026-09-01T00:00:00Z", updatedAt: "2026-09-02T00:00:00Z" };
const result = { items: [ticket], pagination: { page: 1, pageSize: 20, totalItems: 21, totalPages: 2 } };
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
function mock(queue: () => Promise<Response>) {
  const fetch = vi.fn((url: string) => url.endsWith("assignees") ? Promise.resolve(response({ items: [person] })) : queue());
  vi.stubGlobal("fetch", fetch); return fetch;
}
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks(); window.history.replaceState({}, "", "/staff/tickets"); });
describe("Staff Ticket Queue", () => {
  it("shows loading then safe ticket data, labels and detail links", async () => {
    mock(async () => response(result)); render(<StaffTicketQueue />);
    expect(screen.getByText("Loading tickets…")).toBeInTheDocument();
    await screen.findByText(/21 tickets/); expect(screen.getAllByText(ticket.summary)).toHaveLength(2);
    expect(screen.getAllByText("Unassigned").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /View ticket/ })[0]).toHaveAttribute("href", "/staff/tickets/1");
  });
  it("resets page when applying criteria and preserves query in pagination", async () => {
    const fetch = mock(async () => response(result)); render(<StaffTicketQueue />); await screen.findByText(/21 tickets/);
    await userEvent.type(screen.getByLabelText("Search"), "printer"); await userEvent.selectOptions(screen.getByLabelText("Owner"), "me");
    await userEvent.click(screen.getByRole("button", { name: "Apply filters" }));
    await waitFor(() => expect(window.location.search).toContain("page=1"));
    await screen.findByText(/21 tickets/); await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(window.location.search).toContain("search=printer"); expect(window.location.search).toContain("ownerId=me"); expect(window.location.search).toContain("page=2");
    expect(fetch.mock.calls.some(([url]) => url.includes("ownerId=me"))).toBe(true);
  });
  it.each([["", "No tickets yet."], ["?search=missing", "No results match your filters."]])("distinguishes empty from no results %s", async (search, message) => {
    window.history.replaceState({}, "", `/staff/tickets${search}`);
    mock(async () => response({ items: [], pagination: { page: 1, totalItems: 0, totalPages: 0, pageSize: 20 } }));
    render(<StaffTicketQueue />); expect(await screen.findByText(message)).toBeInTheDocument();
  });
  it("does not sanitize invalid URLs and resets on request", async () => {
    window.history.replaceState({}, "", "/staff/tickets?page=bad&page=2");
    const fetch = mock(async () => response({ error: { code: "INVALID_QUERY" } }, 400)); render(<StaffTicketQueue />);
    await screen.findByText(/Invalid queue query/); expect(fetch.mock.calls[0][0]).toContain("page=bad&page=2");
    await userEvent.click(screen.getByRole("button", { name: "Reset filters" })); expect(window.location.search).toBe("");
  });
  it("shows forbidden without ticket content", async () => {
    mock(async () => response({ error: { code: "FORBIDDEN" } }, 403)); render(<StaffTicketQueue />);
    expect(await screen.findByText(/Forbidden:/)).toBeInTheDocument(); expect(screen.queryByText(ticket.summary)).toBeNull();
  });
  it("retries failures safely and reports owner metadata failures separately", async () => {
    let fail = true;
    vi.stubGlobal("fetch", vi.fn(async (url: string) => url.endsWith("assignees") ? response({}, 500) : fail ? response({ error: { message: "database secret" } }, 500) : response(result)));
    render(<StaffTicketQueue />); await screen.findByText(/Unable to load tickets/); expect(screen.queryByText("database secret")).toBeNull();
    expect(screen.getByRole("button", { name: "Retry owners" })).toBeInTheDocument(); fail = false;
    await userEvent.click(screen.getByRole("button", { name: "Retry" })); await screen.findByText(/21 tickets/);
  });
  it("opens read-only detail and returns to queue", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => response(/\/(comments|internal-notes)$/.test(url) ? { items: [] } : url.endsWith("assignees") ? { items: [] } : url.endsWith("/1") ? { ...ticket, description: "Printer offline", relatedSystem: { name: "Office" } } : result)));
    render(<StaffTicketQueue />); await screen.findByText(/21 tickets/);
    await userEvent.click(screen.getAllByRole("link", { name: /View ticket/ })[0]);
    await screen.findByText("Printer offline"); expect(window.location.pathname).toBe("/staff/tickets/1");
    await userEvent.click(screen.getByRole("link", { name: "Back to Ticket Queue" })); await screen.findByText(/21 tickets/);
  });
  it("confirms important status changes and sends the CSRF header", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const fetch = vi.fn(async (url: string, init?: RequestInit) => { void init; return response(/\/(comments|internal-notes)$/.test(url) ? { items: [] } : url.endsWith("assignees") ? { items: [] } : url.endsWith("/1") ? { ...ticket, description: "Printer offline", relatedSystem: { name: "Office" } } : result); });
    vi.stubGlobal("fetch", fetch); Object.defineProperty(document, "cookie", { configurable: true, value: "toktickit_csrf=test-token" });
    render(<StaffTicketQueue />); await screen.findByText(/21 tickets/);
    await userEvent.click(screen.getAllByRole("link", { name: /View ticket/ })[0]); await screen.findByText("Printer offline");
    await userEvent.selectOptions(screen.getByLabelText("Status"), "RESOLVED");
    expect(confirm).toHaveBeenCalled(); expect(fetch.mock.calls.some(([, init]) => init?.method === "PATCH")).toBe(false);
    confirm.mockReturnValue(true); await userEvent.selectOptions(screen.getByLabelText("Status"), "RESOLVED");
    await waitFor(() => expect(fetch.mock.calls.some(([, init]) => init?.method === "PATCH" && new Headers(init.headers).get("X-CSRF-Token") === "test-token")).toBe(true));
    confirm.mockRestore();
  });
});
