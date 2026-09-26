import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import StaffTicketQueue from "../../src/components/StaffTicketQueue.js";

const refresh = vi.fn();
vi.mock("../../src/context/AuthContext.js", () => ({ useAuth: () => ({ refresh }) }));
const person = { id: 2, displayName: "Mali Staff", email: "staff@example.test" };
const other = { ...person, id: 3, displayName: "Niran Staff" };
const initial = { id: 7, ticketNumber: "TKT-2026-000007", summary: "Printer offline", description: "<script>plain text</script>",
  category: { name: "Hardware" }, relatedSystem: { name: "Office" }, requester: { ...person, id: 1 }, owner: null as typeof person | null,
  requestedPriority: "HIGH", itPriority: "HIGH", status: "NEW", createdAt: "2026-09-01T00:00:00Z", updatedAt: "2026-09-02T00:00:00Z",
  attachments: [{ id: 9, fileName: "existing.pdf", mediaType: "application/pdf", sizeBytes: 40, downloadable: true, isRemoved: false },
    { id: 10, fileName: "removed.pdf", mediaType: "application/pdf", sizeBytes: 40, downloadable: false, isRemoved: true }] };
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
function fixture(failure?: (url: string, init?: RequestInit) => Promise<Response> | undefined) {
  let ticket = { ...initial };
  const fetch = vi.fn(async (url: string, init?: RequestInit) => {
    const failed = failure?.(url, init); if (failed) return failed;
    if (init?.method === "POST" || init?.method === "PATCH") {
      const body = JSON.parse(String(init.body ?? "{}"));
      if (url.endsWith("/claim")) ticket = { ...ticket, owner: person };
      else if (url.endsWith("/owner")) ticket = { ...ticket, owner: body.ownerId === other.id ? other : person };
      else ticket = { ...ticket, ...body };
      return response({});
    }
    return response(url.endsWith("assignees") ? { items: [person, other] } : /\/(comments|internal-notes|actions)$/.test(url) ? { items: [] } : ticket);
  });
  vi.stubGlobal("fetch", fetch); return fetch;
}
beforeEach(() => { window.history.replaceState({}, "", "/staff/tickets/7"); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

it("shows loading, safe read-only data and separate public/private sections", async () => {
  fixture(); render(<StaffTicketQueue />);
  expect(screen.getByRole("status")).toHaveTextContent("Loading tickets");
  await screen.findByText(initial.description);
  expect(document.querySelector("script")).toBeNull();
  expect(screen.getByRole("region", { name: "Public Comments" })).toHaveTextContent("Shared with the Requester");
  expect(screen.getByRole("region", { name: "Internal Notes" })).toHaveTextContent("Private");
  expect(screen.queryByRole("textbox", { name: "Requested Priority" })).toBeNull();
});
it("preserves existing attachment downloads and makes removed files unavailable", async () => {
  fixture(); render(<StaffTicketQueue />); await screen.findByText(initial.description);
  expect(screen.getByRole("link", { name: "Download existing.pdf" })).toHaveAttribute("href", expect.stringContaining("/api/staff/tickets/7/attachments/9/download"));
  expect(screen.getByText("removed.pdf")).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Download removed.pdf" })).toBeNull();
});
it("claims, reassigns and changes IT Priority with persisted reloads", async () => {
  const fetch = fixture(); render(<StaffTicketQueue />); await screen.findByText(initial.description);
  await userEvent.click(screen.getByRole("button", { name: "Claim Ticket" }));
  await waitFor(() => expect(screen.getByLabelText("Ticket Owner")).toHaveValue("2"));
  expect(screen.getByRole("button", { name: "Claim Ticket" })).toBeDisabled();
  await userEvent.selectOptions(screen.getByLabelText("Ticket Owner"), "3");
  await waitFor(() => expect(screen.getByLabelText("Ticket Owner")).toHaveValue("3"));
  await userEvent.selectOptions(screen.getByLabelText("IT Priority"), "LOW");
  await waitFor(() => expect(screen.getByLabelText("IT Priority")).toHaveValue("LOW"));
  expect(fetch.mock.calls.some(([url, init]) => url.endsWith("/it-priority") && init?.body === '{"itPriority":"LOW"}')).toBe(true);
  expect(screen.getByText("Requested Priority").nextElementSibling).toHaveTextContent("High");
});
it("offers only permitted statuses and confirms cancellation before sending", async () => {
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false), fetch = fixture();
  render(<StaffTicketQueue />); await screen.findByText(initial.description);
  expect(within(screen.getByLabelText("Status")).getAllByRole("option").map(option => option.textContent)).toEqual(["New", "Open", "Cancelled"]);
  await userEvent.selectOptions(screen.getByLabelText("Status"), "CANCELLED");
  expect(confirm).toHaveBeenCalled(); expect(fetch.mock.calls.some(([, init]) => init?.method === "PATCH")).toBe(false);
  confirm.mockReturnValue(true); await userEvent.selectOptions(screen.getByLabelText("Status"), "CANCELLED");
  await waitFor(() => expect(screen.getByLabelText("Status")).toHaveValue("CANCELLED"));
  expect(screen.getByRole("button", { name: "Claim Ticket" })).toBeDisabled();
  expect(screen.getByLabelText("Ticket Owner")).toBeDisabled();
});
it("disables operations while saving and retains unchanged values on conflict", async () => {
  let finish!: (value: Response) => void;
  fixture((_url, init) => init?.method === "POST" ? new Promise(resolve => { finish = resolve; }) : undefined);
  render(<StaffTicketQueue />); await screen.findByText(initial.description);
  await userEvent.click(screen.getByRole("button", { name: "Claim Ticket" }));
  expect(screen.getByLabelText("IT Priority")).toBeDisabled();
  finish(response({ error: { code: "TICKET_ALREADY_ASSIGNED", message: "database secret" } }, 409));
  expect(await screen.findByRole("alert")).toHaveTextContent("Unable to save");
  expect(screen.queryByText(/database secret/)).toBeNull(); expect(screen.getByLabelText("Ticket Owner")).toHaveValue("");
});
it.each([["FORBIDDEN", 403, "Forbidden:"], ["NOT_FOUND", 404, "Ticket not found."], ["INTERNAL_ERROR", 500, "Unable to load tickets."]])("handles %s without rendering protected detail", async (code, status, message) => {
  fixture(url => url.endsWith("/7") ? Promise.resolve(response({ error: { code, message: "private database error" } }, Number(status))) : undefined);
  render(<StaffTicketQueue />); expect(await screen.findByRole("alert")).toHaveTextContent(String(message));
  expect(screen.queryByText(initial.description)).toBeNull(); expect(screen.queryByText(/private database/)).toBeNull();
});
it("retries a transient detail failure", async () => {
  let fail = true;
  fixture(url => fail && url.endsWith("/7") ? Promise.reject(new Error("offline")) : undefined);
  render(<StaffTicketQueue />); await screen.findByRole("alert"); fail = false;
  await userEvent.click(screen.getByRole("button", { name: "Retry" }));
  expect(await screen.findByText(initial.description)).toBeInTheDocument();
});
