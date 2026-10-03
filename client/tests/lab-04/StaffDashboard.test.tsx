import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../../src/api.js";
import StaffDashboard from "../../src/components/StaffDashboard.js";
import { AuthScreens } from "../../src/AuthApp.js";
import * as auth from "../../src/context/AuthContext.js";

const ticket = (id: number, status: api.StaffTicketStatus = "OPEN"): api.StaffDashboardTicket => ({
  id, ticketNumber: `TKT-2026-${String(id).padStart(6, "0")}`, summary: `Operational ticket ${id}`,
  status, itPriority: "HIGH", owner: null, version: 1, resolvedAt: null, updatedAt: `2026-09-0${Math.min(id, 9)}T10:00:00.000Z`,
});
const zeroStatuses = { NEW: 0, OPEN: 0, IN_PROGRESS: 0, WAITING_FOR_REQUESTER: 0, RESOLVED: 0, CLOSED: 0, REOPENED: 0, CANCELLED: 0 };
const dashboard: api.StaffDashboardData = {
  metrics: { unassignedOpenCount: 8, ownedByMeOpenCount: 3, byStatus: { ...zeroStatuses, NEW: 4, OPEN: 5 }, byItPriority: { LOW: 1, MEDIUM: 3, HIGH: 5 } },
  recentlyUpdated: [ticket(5), ticket(4), ticket(3), ticket(2), ticket(1)],
  urgentTickets: [ticket(6), ticket(7)],
  myActions: [{ id: 20, ticketId: 5, ticketNumber: "TKT-2026-000005", ticketSummary: "Operational ticket 5", description: "Verify network path", status: "IN_PROGRESS", attribution: ["RECORDED", "ASSIGNED"], assignee: { id: 2, displayName: "Mali Staff", role: "IT_STAFF" }, revision: 2, updatedAt: "2026-09-09T10:00:00.000Z" }],
  generatedAt: "2026-09-26T10:00:00.000Z",
};

describe("Staff Dashboard", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/staff/dashboard");
    vi.spyOn(auth, "useAuth").mockReturnValue({ user: { id: 2, displayName: "Mali Staff", email: "staff@example.test", role: "IT_STAFF", mustChangePassword: false }, loading: false, error: "", logoutError: "", refresh: vi.fn().mockResolvedValue(undefined), login: vi.fn(), changePassword: vi.fn(), logout: vi.fn() });
  });
  afterEach(() => vi.restoreAllMocks());

  it("shows loading, exact metrics, bounded lists, current-user Actions, and drill-down destinations", async () => {
    let resolve!: (value: api.StaffDashboardData) => void;
    vi.spyOn(api, "getStaffDashboard").mockReturnValue(new Promise(value => { resolve = value; }));
    render(<StaffDashboard />);
    expect(screen.getByRole("status", { name: "Loading staff dashboard" })).toBeInTheDocument();
    await act(async () => resolve(dashboard));

    const operational = await screen.findByRole("region", { name: "Operational metrics" });
    expect(within(operational).getByRole("link", { name: /Unassigned Open 8/ })).toHaveAttribute("href", "/staff/tickets?ownerId=unassigned&status=OPEN_GROUP");
    expect(within(operational).getByRole("link", { name: /Owned by Me 3/ })).toHaveAttribute("href", "/staff/tickets?ownerId=me&status=OPEN_GROUP");
    expect(screen.getByRole("link", { name: "Open 5" })).toHaveAttribute("href", "/staff/tickets?status=OPEN");
    expect(screen.getByRole("link", { name: "High 5" })).toHaveAttribute("href", "/staff/tickets?itPriority=HIGH");
    const recent = screen.getByRole("heading", { name: "Recently Updated Open Tickets" }).closest("section")!;
    expect(within(recent).getAllByRole("listitem")).toHaveLength(5);
    expect(within(recent).getAllByRole("link")[0]).toHaveAttribute("href", "/staff/tickets/5");
    expect(screen.getByRole("link", { name: /TKT-2026-000005 · In Progress/ })).toHaveAttribute("href", "/staff/tickets/5#actions");
  });

  it("renders numeric zero cards and useful empty states", async () => {
    vi.spyOn(api, "getStaffDashboard").mockResolvedValue({ ...dashboard, metrics: { unassignedOpenCount: 0, ownedByMeOpenCount: 0, byStatus: zeroStatuses, byItPriority: { LOW: 0, MEDIUM: 0, HIGH: 0 } }, recentlyUpdated: [], urgentTickets: [], myActions: [] });
    render(<StaffDashboard />);
    expect(await screen.findByText("No open Tickets.")).toBeInTheDocument();
    expect(screen.getByText("No high-priority Tickets.")).toBeInTheDocument();
    expect(screen.getByText("No Actions recorded by, assigned to, or performed by you.")).toBeInTheDocument();
    expect(screen.getAllByText("0").length).toBeGreaterThanOrEqual(13);
  });

  it("shows a safe failure and retries", async () => {
    const getter = vi.spyOn(api, "getStaffDashboard").mockRejectedValueOnce(new Error("postgres://admin:secret@private")).mockResolvedValueOnce(dashboard);
    render(<StaffDashboard />);
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("We couldn't load the operational dashboard. Try again.");
    expect(alert).not.toHaveTextContent(/postgres|admin|secret|private/);
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(getter).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("Verify network path")).toBeInTheDocument();
  });

  it.each(["IT_STAFF", "ADMINISTRATOR"] as const)("uses Dashboard as the %s home and redirects the requester dashboard", async role => {
    vi.mocked(auth.useAuth).mockReturnValue({ ...auth.useAuth(), user: { ...auth.useAuth().user!, role } });
    vi.spyOn(api, "getStaffDashboard").mockResolvedValue(dashboard);
    window.history.replaceState({}, "", "/dashboard?status=OPEN_GROUP");
    render(<AuthScreens />);
    await screen.findByText("Verify network path");
    expect(window.location.pathname).toBe("/staff/dashboard");
    expect(window.location.search).toBe("");
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Ticket Queue" })).toBeInTheDocument();
    expect(Boolean(screen.queryByRole("link", { name: "User Management" }))).toBe(role === "ADMINISTRATOR");
  });

  it("denies a requester before requesting staff data", () => {
    vi.mocked(auth.useAuth).mockReturnValue({ ...auth.useAuth(), user: { ...auth.useAuth().user!, role: "REQUESTER" } });
    const getter = vi.spyOn(api, "getStaffDashboard");
    render(<AuthScreens />);
    expect(screen.getByRole("heading", { name: "Forbidden" })).toBeInTheDocument();
    expect(getter).not.toHaveBeenCalled();
  });

  it("clears privileged data on a forbidden response", async () => {
    vi.spyOn(api, "getStaffDashboard").mockRejectedValue(new api.ApiResponseError(403, "FORBIDDEN", "private detail"));
    render(<StaffDashboard />);
    expect(await screen.findByRole("heading", { name: "Forbidden" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Operational metrics" })).not.toBeInTheDocument();
    expect(screen.queryByText("private detail")).not.toBeInTheDocument();
  });
});
