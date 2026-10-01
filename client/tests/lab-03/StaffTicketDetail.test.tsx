import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import StaffTicketQueue from "../../src/components/StaffTicketQueue.js";

const refresh = vi.fn();
vi.mock("../../src/context/AuthContext.js", () => ({ useAuth: () => ({ refresh, user: person }) }));
const person = { id: 2, displayName: "Mali Staff", email: "staff@example.test" };
const other = { ...person, id: 3, displayName: "Niran Staff" };
const initial = { id: 7, ticketNumber: "TKT-2026-000007", summary: "Printer offline", description: "<script>plain text</script>",
  category: { name: "Hardware" }, relatedSystem: { name: "Office" }, requester: { ...person, id: 1 }, owner: null as typeof person | null,
  version: 1, requestedPriority: "HIGH", itPriority: "HIGH", status: "NEW", createdAt: "2026-09-01T00:00:00Z", updatedAt: "2026-09-02T00:00:00Z",
  attachments: [{ id: 9, fileName: "existing.pdf", mediaType: "application/pdf", sizeBytes: 40, downloadable: true, isRemoved: false },
    { id: 10, fileName: "removed.pdf", mediaType: "application/pdf", sizeBytes: 40, downloadable: false, isRemoved: true }] };
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const action = { id: 20, ticketId: 7, description: "Inspect printer", result: null, status: "PLANNED", performedBy: null,
  recordedBy: person, assignee: person, workflowCycle: 1, followUpRequired: false, followUpNote: null, attachmentNotes: null,
  revision: 1, createdAt: "2026-10-01T00:00:00Z", updatedAt: "2026-10-01T00:00:00Z", completedAt: null,
  cancelledAt: null, cancelledBy: null, cancellationSource: null };
function fixture(failure?: (url: string, init?: RequestInit) => Promise<Response> | undefined) {
  let ticket = { ...initial };
  let actions: typeof action[] = [];
  const fetch = vi.fn(async (url: string, init?: RequestInit) => {
    const failed = failure?.(url, init); if (failed) return failed;
    if (init?.method === "POST" || init?.method === "PATCH") {
      const body = JSON.parse(String(init.body ?? "{}"));
      ticket = { ...ticket, version: ticket.version + 1 };
      if (url.endsWith("/actions")) {
        const created = { ...action, ...body, assignee: body.assigneeId === other.id ? other : person };
        actions = [...actions, created];
        return response({ action: created, ticketVersion: ticket.version, replayed: false }, 201);
      }
      if (url.endsWith("/claim")) ticket = { ...ticket, owner: person };
      else if (url.endsWith("/owner")) ticket = { ...ticket, owner: body.ownerId === other.id ? other : person };
      else if (url.endsWith("/it-priority")) ticket = { ...ticket, itPriority: body.itPriority };
      else if (url.endsWith("/status")) ticket = { ...ticket, status: body.status };
      return response({ version: ticket.version, updatedAt: ticket.updatedAt,
        ...(url.endsWith("/claim") || url.endsWith("/owner") ? { owner: ticket.owner } : url.endsWith("/it-priority") ? { itPriority: ticket.itPriority } : { status: ticket.status }) });
    }
    return response(url.endsWith("assignees") ? { items: [person, other] } : url.endsWith("/actions") ? { items: actions } : /\/(comments|internal-notes)$/.test(url) ? { items: [] } : ticket);
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
  expect(fetch.mock.calls.some(([url, init]) => url.endsWith("/it-priority") && init?.body === '{"itPriority":"LOW","expectedTicketVersion":3}')).toBe(true);
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

async function enterActionDraft(description = "Inspect printer") {
  await userEvent.click(screen.getByRole("button", { name: "Add Action" }));
  await userEvent.type(screen.getByLabelText("Create Action Description"), description);
  await userEvent.selectOptions(screen.getByLabelText("Create Action Assignee"), String(person.id));
}

it("shares the returned Action version with the next Ticket operation", async () => {
  const fetch = fixture(); render(<StaffTicketQueue />); await screen.findByText(initial.description);
  await enterActionDraft(); await userEvent.click(screen.getByRole("button", { name: "Create Action" }));
  await screen.findByText("Action created successfully.");
  await waitFor(() => expect(screen.getByLabelText("IT Priority")).toBeEnabled());
  await userEvent.selectOptions(screen.getByLabelText("IT Priority"), "LOW");
  await waitFor(() => expect(screen.getByLabelText("IT Priority")).toHaveValue("LOW"));
  const call = fetch.mock.calls.find(([url, init]) => url.endsWith("/it-priority") && init?.method === "PATCH");
  expect(JSON.parse(String(call?.[1]?.body))).toEqual({ itPriority: "LOW", expectedTicketVersion: 2 });
});

it("keeps an Action draft mounted through Ticket refresh and sends the new Ticket version", async () => {
  const fetch = fixture(); render(<StaffTicketQueue />); await screen.findByText(initial.description);
  await enterActionDraft("Keep this work description");
  const description = screen.getByLabelText("Create Action Description");
  await userEvent.selectOptions(screen.getByLabelText("IT Priority"), "LOW");
  await waitFor(() => expect(screen.getByLabelText("IT Priority")).toHaveValue("LOW"));
  await waitFor(() => expect(screen.getByRole("button", { name: "Create Action" })).toBeEnabled());
  expect(screen.getByLabelText("Create Action Description")).toBe(description);
  expect(description).toHaveValue("Keep this work description");
  await userEvent.click(screen.getByRole("button", { name: "Create Action" }));
  await screen.findByText("Action created successfully.");
  const call = fetch.mock.calls.find(([url, init]) => url.endsWith("/actions") && init?.method === "POST");
  expect(JSON.parse(String(call?.[1]?.body))).toMatchObject({ description: "Keep this work description", expectedTicketVersion: 2 });
});

it("preserves Action drafts on stale Ticket conflicts and requires reload before retrying", async () => {
  let stale = true, refreshed = false;
  const fetch = fixture((url, init) => {
    if (url.endsWith("/it-priority") && init?.method === "PATCH" && stale) { stale = false; return Promise.resolve(response({ error: { code: "STALE_TICKET", message: "private server detail" } }, 409)); }
    if (url.endsWith("/7") && !init?.method && !stale) { refreshed = true; return Promise.resolve(response({ ...initial, version: 8, itPriority: "MEDIUM" })); }
    return undefined;
  });
  render(<StaffTicketQueue />); await screen.findByText(initial.description);
  await enterActionDraft("Retain my unsaved work");
  const description = screen.getByLabelText("Create Action Description");
  await userEvent.selectOptions(screen.getByLabelText("IT Priority"), "LOW");
  expect(await screen.findByRole("alert")).toHaveTextContent("This Ticket changed after you opened it");
  expect(screen.queryByText(/private server detail/)).toBeNull();
  expect(screen.getByLabelText("IT Priority")).toBeDisabled();
  expect(screen.getByRole("button", { name: "Create Action" })).toBeDisabled();
  await userEvent.click(screen.getByRole("button", { name: "Reload Ticket" }));
  await waitFor(() => expect(screen.getByLabelText("IT Priority")).toHaveValue("MEDIUM"));
  expect(refreshed).toBe(true);
  expect(screen.getByLabelText("Create Action Description")).toBe(description);
  expect(description).toHaveValue("Retain my unsaved work");
  await userEvent.selectOptions(screen.getByLabelText("IT Priority"), "LOW");
  await waitFor(() => expect(fetch.mock.calls.filter(([url, init]) => url.endsWith("/it-priority") && init?.method === "PATCH")).toHaveLength(2));
  const calls = fetch.mock.calls.filter(([url, init]) => url.endsWith("/it-priority") && init?.method === "PATCH");
  expect(JSON.parse(String(calls[1][1]?.body))).toEqual({ itPriority: "LOW", expectedTicketVersion: 8 });
});

it("prevents overlapping Ticket and Action writes in both directions", async () => {
  let finish!: (value: Response) => void;
  let block: "ticket" | "action" = "ticket";
  fixture((url, init) => (block === "ticket" && url.endsWith("/it-priority") && init?.method === "PATCH") || (block === "action" && url.endsWith("/actions") && init?.method === "POST")
    ? new Promise(resolve => { finish = resolve; }) : undefined);
  render(<StaffTicketQueue />); await screen.findByText(initial.description);
  await enterActionDraft();
  await userEvent.selectOptions(screen.getByLabelText("IT Priority"), "LOW");
  expect(screen.getByRole("button", { name: "Create Action" })).toBeDisabled();
  finish(response({ error: { code: "RESOLUTION_GATE_NOT_MET" } }, 409));
  await waitFor(() => expect(screen.getByRole("button", { name: "Create Action" })).toBeEnabled());
  block = "action";
  await userEvent.click(screen.getByRole("button", { name: "Create Action" }));
  expect(screen.getByLabelText("IT Priority")).toBeDisabled();
  expect(screen.getByLabelText("Ticket Owner")).toBeDisabled();
  expect(screen.getByLabelText("Status")).toBeDisabled();
  finish(response({ error: { code: "VALIDATION_ERROR" } }, 400));
  await waitFor(() => expect(screen.getByLabelText("IT Priority")).toBeEnabled());
  expect(screen.getByLabelText("Create Action Description")).toHaveValue("Inspect printer");
});

it("retains drafts and the accepted Ticket version when its subsequent refresh fails", async () => {
  let failReload = false;
  const fetch = fixture((url, init) => {
    if (url.endsWith("/it-priority") && init?.method === "PATCH") failReload = true;
    if (url.endsWith("/7") && failReload) { failReload = false; return Promise.reject(new Error("offline")); }
    return undefined;
  });
  render(<StaffTicketQueue />); await screen.findByText(initial.description);
  await enterActionDraft("Keep the accepted change draft");
  const description = screen.getByLabelText("Create Action Description");
  await userEvent.selectOptions(screen.getByLabelText("IT Priority"), "LOW");
  expect(await screen.findByRole("alert")).toHaveTextContent("The change was saved, but the Ticket could not be refreshed");
  expect(screen.getByLabelText("IT Priority")).toHaveValue("LOW");
  expect(screen.getByLabelText("Create Action Description")).toBe(description);
  expect(screen.getByRole("button", { name: "Create Action" })).toBeDisabled();
  await userEvent.click(screen.getByRole("button", { name: "Reload Ticket" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Create Action" })).toBeEnabled());
  await userEvent.click(screen.getByRole("button", { name: "Create Action" }));
  await screen.findByText("Action created successfully.");
  const call = fetch.mock.calls.find(([url, init]) => url.endsWith("/actions") && init?.method === "POST");
  expect(JSON.parse(String(call?.[1]?.body))).toMatchObject({ expectedTicketVersion: 2 });
  expect(fetch.mock.calls.filter(([url, init]) => url.endsWith("/it-priority") && init?.method === "PATCH")).toHaveLength(1);
});

it("explains lost write permission and clears protected detail when reload also denies access", async () => {
  let denied = false;
  fixture((url, init) => {
    if (url.endsWith("/claim") && init?.method === "POST") { denied = true; return Promise.resolve(response({ error: { code: "FORBIDDEN", message: "private permission detail" } }, 403)); }
    return url.endsWith("/7") && denied ? Promise.resolve(response({ error: { code: "FORBIDDEN" } }, 403)) : undefined;
  });
  render(<StaffTicketQueue />); await screen.findByText(initial.description);
  await enterActionDraft("Private unsaved work");
  await userEvent.click(screen.getByRole("button", { name: "Claim Ticket" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("You no longer have permission to change this Ticket");
  expect(screen.queryByText(/private permission detail/)).toBeNull();
  await userEvent.click(screen.getByRole("button", { name: "Reload Ticket" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Forbidden: You do not have access to this screen.");
  expect(screen.queryByText(initial.description)).toBeNull();
  expect(screen.queryByLabelText("Create Action Description")).toBeNull();
});

it("blocks Ticket writes after an uncertain Action response and preserves the create request for a safe retry", async () => {
  let version = 1, posts = 0;
  const fetch = fixture((url, init) => {
    if (url.endsWith("/actions") && init?.method === "POST") {
      posts += 1; version = 4;
      if (posts === 1) return Promise.resolve(response({ error: { code: "INTERNAL_ERROR", message: "private database detail" } }, 500));
      const body = JSON.parse(String(init.body));
      return Promise.resolve(response({ action: { ...action, ...body }, ticketVersion: version, replayed: true }));
    }
    if (url.endsWith("/7") && version > 1) return Promise.resolve(response({ ...initial, version }));
    return undefined;
  });
  render(<StaffTicketQueue />); await screen.findByText(initial.description);
  await enterActionDraft("Retry my original create intent");
  const description = screen.getByLabelText("Create Action Description");
  await userEvent.click(screen.getByRole("button", { name: "Create Action" }));
  await screen.findByRole("alert");
  expect(screen.queryByText(/private database detail/)).toBeNull();
  expect(screen.getByLabelText("IT Priority")).toBeDisabled();
  expect(screen.getByLabelText("Ticket Owner")).toBeDisabled();
  await userEvent.click(screen.getByRole("button", { name: "Reload Actions" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Create Action" })).toBeEnabled());
  expect(screen.getByLabelText("Create Action Description")).toBe(description);
  expect(description).toHaveValue("Retry my original create intent");
  await userEvent.click(screen.getByRole("button", { name: "Create Action" }));
  await screen.findByText("Action created successfully.");
  await waitFor(() => expect(screen.getByLabelText("IT Priority")).toBeEnabled());
  const calls = fetch.mock.calls.filter(([url, init]) => url.endsWith("/actions") && init?.method === "POST");
  const first = JSON.parse(String(calls[0][1]?.body)), retry = JSON.parse(String(calls[1][1]?.body));
  expect(retry).toMatchObject({ clientRequestId: first.clientRequestId, expectedTicketVersion: 4, description: first.description });
  expect(first.expectedTicketVersion).toBe(1);
});
