import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../../src/App.js";
import * as api from "../../src/api.js";
import { RequesterProvider } from "../../src/context/RequesterContext.js";
import { mockRequesterSession } from "../auth-fixture.js";

const requester: api.Requester = { id: 12, displayName: "Mali Chantarangsu", email: "mali@example.test" };
const ticket = (id: number, status = "Open"): api.TicketSummary => ({
  id,
  ticketNumber: `TKT-2026-${String(id).padStart(6, "0")}`,
  summary: `Owned ticket ${id}`,
  requestedPriority: "HIGH",
  status,
  category: { id: 3, name: "Hardware" },
  relatedSystem: { id: 8, name: "Office Workstation" },
  activeAttachmentCount: 0,
  createdAt: "2026-09-01T08:00:00.000Z",
  updatedAt: `2026-09-0${Math.min(id, 9)}T10:00:00.000Z`,
});
const dashboard: api.RequesterDashboardData = {
  metrics: { openCount: 7, waitingForRequesterCount: 2 },
  recentlyUpdated: [ticket(5), ticket(4), ticket(3), ticket(2), ticket(1)],
  recentlyResolved: [ticket(8, "Closed"), ticket(7, "Resolved")],
  generatedAt: "2026-09-26T10:00:00.000Z",
};

function renderDashboard() {
  render(<RequesterProvider><App /></RequesterProvider>);
}

describe("Requester Dashboard", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    window.history.replaceState({}, "", "/dashboard");
    mockRequesterSession(requester);
  });
  afterEach(() => vi.restoreAllMocks());

  it("shows loading, authoritative metrics, ordered bounded summaries, and working drill-down links", async () => {
    let resolve!: (value: api.RequesterDashboardData) => void;
    vi.spyOn(api, "getRequesterDashboard").mockReturnValue(new Promise(value => { resolve = value; }));
    renderDashboard();
    expect(screen.getByRole("status", { name: "Loading dashboard" })).toBeInTheDocument();
    await act(async () => resolve(dashboard));

    const metrics = await screen.findByRole("region", { name: "Ticket metrics" });
    expect(within(metrics).getByText("7")).toBeInTheDocument();
    expect(within(metrics).getByText("2")).toBeInTheDocument();
    const updated = screen.getByRole("heading", { name: "Recently Updated" }).closest("section")!;
    expect(within(updated).getAllByRole("listitem")).toHaveLength(5);
    expect(within(updated).getAllByRole("link")[0]).toHaveAttribute("href", "/tickets/5");

    await userEvent.click(screen.getByRole("link", { name: /Open Tickets 7/ }));
    expect(window.location.pathname + window.location.search).toBe("/tickets?status=OPEN_GROUP");
  });

  it("renders the zero state and navigates to ticket creation", async () => {
    vi.spyOn(api, "getRequesterDashboard").mockResolvedValue({ ...dashboard, metrics: { openCount: 0, waitingForRequesterCount: 0 }, recentlyUpdated: [], recentlyResolved: [] });
    renderDashboard();
    const heading = await screen.findByRole("heading", { name: "No Tickets yet" });
    await userEvent.click(within(heading.closest("section")!).getByRole("link", { name: "Create Ticket" }));
    expect(window.location.pathname).toBe("/tickets/new");
  });

  it("shows a safe failure and retries without displaying server details", async () => {
    const getDashboard = vi.spyOn(api, "getRequesterDashboard")
      .mockRejectedValueOnce(new Error("postgres://admin:secret@private"))
      .mockResolvedValueOnce(dashboard);
    renderDashboard();
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("We couldn't load your dashboard. Try again.");
    expect(alert).not.toHaveTextContent(/postgres|admin|secret|private/);
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(getDashboard).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("Owned ticket 5")).toBeInTheDocument();
  });

  it("uses Dashboard as the requester home and exposes the primary navigation", async () => {
    vi.spyOn(api, "getRequesterDashboard").mockResolvedValue(dashboard);
    window.history.replaceState({}, "", "/");
    renderDashboard();
    expect(await screen.findByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
    expect(window.location.pathname).toBe("/dashboard");
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "My Tickets" })).toBeInTheDocument();
  });
});
