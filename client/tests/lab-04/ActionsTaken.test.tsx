import { useState, type ComponentProps } from "react";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { ActionsTaken, type ActionAssignee } from "../../src/components/ActionsTaken.js";

const staff = [
  { id: 2, displayName: "Mali Staff", email: "mali@example.test", role: "IT_STAFF" },
  { id: 3, displayName: "Niran Admin", email: "niran@example.test", role: "ADMINISTRATOR" },
];
type Action = {
  id: number; ticketId: number; description: string; result: string | null; status: string;
  recordedBy: ActionAssignee; performedBy: ActionAssignee | null; assignee: ActionAssignee; workflowCycle: number;
  followUpRequired: boolean; followUpNote: string | null; attachmentNotes: string | null; revision: number;
  createdAt: string; updatedAt: string; completedAt: string | null;
  cancelledAt: string | null; cancelledBy: ActionAssignee | null; cancellationSource: string | null;
};
const planned: Action = {
  id: 11, ticketId: 7, description: "Inspect the printer queue", result: null,
  status: "PLANNED", recordedBy: staff[1], performedBy: null, assignee: staff[0], workflowCycle: 1,
  followUpRequired: false, followUpNote: null, attachmentNotes: "See diagnostic.pdf", revision: 1,
  createdAt: "2026-09-25T09:00:00Z", updatedAt: "2026-09-25T09:00:00Z", completedAt: null,
  cancelledAt: null, cancelledBy: null, cancellationSource: null,
};
const completed: Action = { ...planned, id: 12, description: "Restarted print service", status: "COMPLETED", result: "Printing restored", performedBy: staff[0], revision: 3, completedAt: "2026-09-25T10:05:00Z", updatedAt: "2026-09-25T10:05:00Z" };
const cancelled: Action = { ...planned, id: 13, description: "Monitor the old printer", status: "CANCELLED", followUpRequired: true, followUpNote: "Check next shift", cancelledBy: staff[1], cancelledAt: "2026-09-25T11:00:00Z", cancellationSource: "TICKET_CASCADE", revision: 2 };
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
type Write = { url: string; method: string; body: Record<string, unknown> };

function Harness(props: Partial<ComponentProps<typeof ActionsTaken>>) {
  const [version, setVersion] = useState(props.ticketVersion ?? 4);
  return <ActionsTaken ticketId={7} staff assignees={staff} ticketStatus="OPEN" currentUserId={2}
    {...props} ticketVersion={version} onTicketVersionChange={next => { setVersion(next); props.onTicketVersionChange?.(next); }} />;
}

function mockApi(initial: Action[] = []) {
  let items = initial, version = 4;
  const writes: Write[] = [];
  const fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    if (!init?.method || init.method === "GET") return response({ items });
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    writes.push({ url: String(url), method: init.method, body });
    const current = items.find(action => String(url).includes(`/actions/${action.id}`));
    const action = {
      ...(current ?? { ...planned, id: 20 }), ...body,
      assignee: staff.find(person => person.id === body.assigneeId) ?? current?.assignee ?? staff[0],
      revision: current ? current.revision + 1 : 1,
      performedBy: body.status === "COMPLETED" ? current?.assignee : current?.performedBy ?? null,
      completedAt: body.status === "COMPLETED" ? "2026-09-25T12:00:00Z" : null,
    } as Action;
    items = current ? items.map(item => item.id === current.id ? action : item) : [...items, action];
    return response({ action, ticketVersion: ++version, ...(init.method === "POST" ? { replayed: false } : {}) }, init.method === "POST" ? 201 : 200);
  });
  vi.stubGlobal("fetch", fetch);
  return { fetch, writes };
}

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it("shows ordered shared records to the requester without mutation controls or audit data", async () => {
  const { fetch } = mockApi([planned, completed, cancelled]);
  render(<ActionsTaken ticketId={7} />);
  const list = await screen.findByRole("list");
  expect(within(list).getAllByRole("listitem").map(item => item.textContent)).toEqual([
    expect.stringContaining(planned.description), expect.stringContaining(completed.description), expect.stringContaining(cancelled.description),
  ]);
  expect(within(list).getByText(/Check next shift/)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Add Action|Edit Action|Start Action|Complete Action|Cancel Action/ })).toBeNull();
  expect(fetch.mock.calls[0][0]).toEqual(expect.stringContaining("/api/tickets/7/actions"));
  expect(fetch.mock.calls.some(([url]) => String(url).includes("/events"))).toBe(false);
});

it("keeps completed and cancelled records immutable and identifies historical cascade follow-up", async () => {
  mockApi([completed, cancelled]);
  render(<Harness />);
  const list = await screen.findByRole("list");
  expect(within(list).queryByRole("button")).toBeNull();
  expect(screen.queryByRole("button", { name: /Reopen Action|Restore Action/ })).toBeNull();
  const cancelledCard = within(list).getAllByRole("listitem")[1];
  expect(cancelledCard).toHaveTextContent(/historical/i);
  expect(cancelledCard).toHaveTextContent("Niran Admin");
  expect(cancelledCard).toHaveTextContent(/Ticket cancellation/i);
  expect(cancelledCard.querySelector('time[datetime="2026-09-25T11:00:00Z"]')).not.toBeNull();
});

it.each(["RESOLVED", "CLOSED", "CANCELLED"])("makes Actions read-only while the parent Ticket is %s", async ticketStatus => {
  mockApi([planned]);
  render(<Harness ticketStatus={ticketStatus} />);
  await screen.findByText(planned.description);
  expect(screen.queryByRole("button", { name: /Add Action|Edit Action|Start Action|Complete Action|Cancel Action/ })).toBeNull();
  expect(screen.getByText(/reopen.*Ticket/i)).toBeInTheDocument();
});

it("announces validation and focuses the first invalid required field before sending", async () => {
  const { writes } = mockApi();
  render(<Harness />);
  await screen.findByText(/No Actions/i);
  await userEvent.click(screen.getByRole("button", { name: "Add Action" }));
  await userEvent.click(screen.getByRole("button", { name: "Create Action" }));
  expect(screen.getByRole("alert")).toHaveTextContent(/description/i);
  expect(screen.getByLabelText("Create Action Description")).toHaveFocus();
  expect(screen.getByLabelText("Create Action Description")).toHaveAttribute("aria-invalid", "true");
  await userEvent.type(screen.getByLabelText("Create Action Description"), "Inspect printer");
  await userEvent.click(screen.getByRole("button", { name: "Create Action" }));
  expect(screen.getByLabelText("Create Action Assignee")).toHaveFocus();
  await userEvent.selectOptions(screen.getByLabelText("Create Action Assignee"), "2");
  await userEvent.click(screen.getByRole("checkbox", { name: /Follow-up required/ }));
  await userEvent.click(screen.getByRole("button", { name: "Create Action" }));
  expect(screen.getByLabelText("Create Action Follow-up Note")).toHaveFocus();
  expect(writes).toHaveLength(0);
});

it("keeps focus in the field being corrected while the other required error remains", async () => {
  mockApi();
  render(<Harness />);
  await screen.findByText(/No Actions/i);
  await userEvent.click(screen.getByRole("button", { name: "Add Action" }));
  await userEvent.click(screen.getByRole("button", { name: "Create Action" }));
  const description = screen.getByLabelText("Create Action Description");
  expect(description).toHaveFocus();
  await userEvent.type(description, "Keep typing the complete diagnostic description");
  expect(description).toHaveValue("Keep typing the complete diagnostic description");
  expect(description).toHaveFocus();
  expect(description).toHaveAttribute("aria-invalid", "false");
  expect(screen.getByRole("alert")).toHaveTextContent("Choose an assignee");
  await userEvent.click(screen.getByLabelText("Create Action Assignee"));
  expect(screen.getByLabelText("Create Action Assignee")).toHaveFocus();
});

it.each([{ code: "FORBIDDEN", status: 403 }, { code: "NOT_FOUND", status: 404 }])("closes a protected draft and removes previously shown records after $code", async ({ code, status }) => {
  vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => init?.method === "PATCH"
    ? response({ error: { code, message: "private diagnostic details" } }, status)
    : response({ items: [planned] })));
  render(<Harness />);
  await screen.findByText(planned.description);
  await userEvent.click(screen.getByRole("button", { name: "Edit Action" }));
  await userEvent.type(screen.getByLabelText("Edit Action Description"), " local draft");
  await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(/permission|not be found/i);
  expect(screen.queryByLabelText("Edit Action Description")).toBeNull();
  expect(screen.queryByRole("list")).toBeNull();
  expect(screen.queryByText(planned.description)).toBeNull();
  expect(screen.queryByRole("button", { name: /Add Action|Edit Action|Save changes/ })).toBeNull();
  expect(screen.queryByText("private diagnostic details")).toBeNull();
});

it("moves focus to the Actions heading when completion removes its initiating control", async () => {
  mockApi([{ ...planned, status: "IN_PROGRESS", result: "Printing restored" }]);
  render(<Harness />);
  await screen.findByText(planned.description);
  await userEvent.click(screen.getByRole("button", { name: "Complete Action" }));
  await screen.findByText("Completed");
  expect(screen.queryByRole("button", { name: "Complete Action" })).toBeNull();
  await waitFor(() => expect(screen.getByRole("heading", { name: "Actions Taken" })).toHaveFocus());
});

it("uses each confirmed parent version and Action revision through create, edit, start and completion", async () => {
  const { writes } = mockApi();
  const onTicketVersionChange = vi.fn();
  render(<Harness onTicketVersionChange={onTicketVersionChange} />);
  await screen.findByText(/No Actions/i);
  await userEvent.click(screen.getByRole("button", { name: "Add Action" }));
  await userEvent.type(screen.getByLabelText("Create Action Description"), "Replace toner");
  await userEvent.selectOptions(screen.getByLabelText("Create Action Assignee"), "2");
  await userEvent.click(screen.getByRole("button", { name: "Create Action" }));
  await screen.findByText("Replace toner");
  await userEvent.click(screen.getByRole("button", { name: "Edit Action" }));
  await userEvent.type(screen.getByLabelText("Edit Action Result"), "Printing restored");
  await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
  await screen.findByText("Printing restored");
  await userEvent.click(screen.getByRole("button", { name: "Start Action" }));
  await screen.findByText("In progress");
  await userEvent.click(screen.getByRole("button", { name: "Complete Action" }));
  await screen.findByText("Completed");
  expect(writes.map(write => write.body)).toEqual([
    expect.objectContaining({ expectedTicketVersion: 4, description: "Replace toner", assigneeId: 2 }),
    expect.objectContaining({ expectedTicketVersion: 5, revision: 1, result: "Printing restored" }),
    expect.objectContaining({ expectedTicketVersion: 6, revision: 2, status: "IN_PROGRESS" }),
    expect.objectContaining({ expectedTicketVersion: 7, revision: 3, status: "COMPLETED", result: "Printing restored" }),
  ]);
  expect(onTicketVersionChange.mock.calls.map(([version]) => version)).toEqual([5, 6, 7, 8]);
  expect(screen.queryByRole("button", { name: "Edit Action" })).toBeNull();
});

it("explains assignee-only completion and does not allow another staff member to complete", async () => {
  mockApi([{ ...planned, status: "IN_PROGRESS", result: "Printer ready" }]);
  render(<Harness currentUserId={3} />);
  await screen.findByText(planned.description);
  const complete = screen.queryByRole("button", { name: "Complete Action" });
  if (complete) expect(complete).toBeDisabled();
  expect(screen.getByText(/Only the assigned staff member can complete/i)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Edit Action" })).toBeEnabled();
});

it("requires Result and cleared follow-up before completing or cancelling", async () => {
  const { writes } = mockApi([{ ...planned, status: "IN_PROGRESS", followUpRequired: true, followUpNote: "Verify next shift" }]);
  render(<Harness />);
  await screen.findByText(planned.description);
  await userEvent.click(screen.getByRole("button", { name: "Complete Action" }));
  expect(screen.getByRole("alert")).toHaveTextContent(/Result|follow-up/i);
  expect(writes).toHaveLength(0);
  await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
  vi.spyOn(window, "confirm").mockReturnValue(true);
  await userEvent.click(screen.getByRole("button", { name: "Cancel Action" }));
  expect(screen.getByRole("alert")).toHaveTextContent(/follow-up/i);
  expect(writes).toHaveLength(0);
});

it("retains a stale edit and explicitly reloads both concurrency tokens before reapplying", async () => {
  let revision = 1;
  const writes: Record<string, unknown>[] = [];
  const fetch = vi.fn(async (_url: string, init?: RequestInit) => {
    if (init?.method === "PATCH") {
      const body = JSON.parse(String(init.body)); writes.push(body);
      if (writes.length === 1) return response({ error: { code: "STALE_ACTION", message: "private diagnostic" } }, 409);
      return response({ action: { ...planned, description: body.description, revision: 4 }, ticketVersion: 10 });
    }
    return response({ items: [{ ...planned, revision }] });
  });
  vi.stubGlobal("fetch", fetch);
  const onReloadTicket = vi.fn(async () => ({ version: 9, status: "OPEN" }));
  render(<Harness onReloadTicket={onReloadTicket} />);
  await screen.findByText(planned.description);
  await userEvent.click(screen.getByRole("button", { name: "Edit Action" }));
  const description = screen.getByLabelText("Edit Action Description");
  await userEvent.clear(description); await userEvent.type(description, "Keep this local draft");
  await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(/Reload/i);
  expect(screen.getByLabelText("Edit Action Description")).toHaveValue("Keep this local draft");
  expect(screen.queryByText("private diagnostic")).toBeNull();
  revision = 3;
  await userEvent.click(screen.getByRole("button", { name: "Reload Actions" }));
  await waitFor(() => expect(onReloadTicket).toHaveBeenCalledOnce());
  await waitFor(() => expect(screen.getByRole("button", { name: "Save changes" })).toBeEnabled());
  expect(screen.getByLabelText("Edit Action Description")).toHaveValue("Keep this local draft");
  await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
  await waitFor(() => expect(writes).toHaveLength(2));
  expect(writes[1]).toMatchObject({ description: "Keep this local draft", expectedTicketVersion: 9, revision: 3 });
});

it("retains create intent and its request ID across an uncertain failure while preventing duplicate submits", async () => {
  let finish!: (value: Response) => void;
  let items: Action[] = [];
  const posts: Record<string, unknown>[] = [];
  vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
    if (init?.method !== "POST") return response({ items });
    posts.push(JSON.parse(String(init.body)));
    if (posts.length === 1) {
      items = [{ ...planned, id: 21, description: "Replace toner" }];
      throw new TypeError("Response was lost after the server accepted the create");
    }
    return new Promise<Response>(resolve => { finish = resolve; });
  }));
  const onReloadTicket = vi.fn(async () => ({ version: 5, status: "OPEN" }));
  render(<Harness onReloadTicket={onReloadTicket} />);
  await screen.findByText(/No Actions/i);
  await userEvent.click(screen.getByRole("button", { name: "Add Action" }));
  await userEvent.type(screen.getByLabelText("Create Action Description"), "Replace toner");
  await userEvent.selectOptions(screen.getByLabelText("Create Action Assignee"), "2");
  await userEvent.click(screen.getByRole("button", { name: "Create Action" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(/kept|try again/i);
  expect(screen.getByLabelText("Create Action Description")).toHaveValue("Replace toner");
  expect(screen.getByRole("button", { name: "Create Action" })).toBeDisabled();
  await userEvent.click(screen.getByRole("button", { name: "Reload Actions" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Create Action" })).toBeEnabled());
  expect(within(screen.getByRole("list")).getAllByRole("listitem")).toHaveLength(1);
  await userEvent.dblClick(screen.getByRole("button", { name: "Create Action" }));
  expect(posts).toHaveLength(2);
  expect(posts[1].clientRequestId).toEqual(posts[0].clientRequestId);
  expect(posts[1].expectedTicketVersion).toBe(5);
  expect(screen.getByRole("button", { name: /Saving/ })).toBeDisabled();
  finish(response({ action: { ...planned, id: 21, description: "Replace toner" }, ticketVersion: 5, replayed: true }));
  await waitFor(() => expect(screen.queryByLabelText("Create Action Description")).toBeNull());
  expect(screen.getByRole("status")).toHaveTextContent(/created successfully/i);
  expect(within(screen.getByRole("list")).getAllByRole("listitem")).toHaveLength(1);
});

it.each([{ action: planned }, { action: planned, ticketVersion: "5" }, { ticketVersion: 5 }])("does not announce success or discard a draft when a success response violates the API contract", async body => {
  const onTicketVersionChange = vi.fn();
  vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => init?.method === "POST" ? response(body, 201) : response({ items: [] })));
  render(<Harness onTicketVersionChange={onTicketVersionChange} />);
  await screen.findByText(/No Actions/i);
  await userEvent.click(screen.getByRole("button", { name: "Add Action" }));
  await userEvent.type(screen.getByLabelText("Create Action Description"), "Retain this entry");
  await userEvent.selectOptions(screen.getByLabelText("Create Action Assignee"), "2");
  await userEvent.click(screen.getByRole("button", { name: "Create Action" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(/Unable|try again|Reload/i);
  expect(screen.getByLabelText("Create Action Description")).toHaveValue("Retain this entry");
  expect(screen.queryByText(/created successfully/i)).toBeNull();
  expect(onTicketVersionChange).not.toHaveBeenCalled();
});

it("keeps the draft and offers assignee recovery for an eligibility conflict", async () => {
  const onAssigneesReload = vi.fn(async () => undefined);
  vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => init?.method === "PATCH" ? response({ error: { code: "INVALID_ACTION_ASSIGNEE", message: "database password" } }, 409) : response({ items: [planned] })));
  render(<Harness onAssigneesReload={onAssigneesReload} />);
  await screen.findByText(planned.description);
  await userEvent.click(screen.getByRole("button", { name: "Edit Action" }));
  await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(/assignee.*active|eligible/i);
  expect(screen.getByLabelText("Edit Action Description")).toHaveValue(planned.description);
  expect(screen.queryByText("database password")).toBeNull();
  await userEvent.click(screen.getByRole("button", { name: "Reload assignees" }));
  expect(onAssigneesReload).toHaveBeenCalledOnce();
});

it("handles failed loading and retry without exposing a server diagnostic", async () => {
  let failed = true;
  vi.stubGlobal("fetch", vi.fn(async () => failed ? response({ error: { code: "INTERNAL_ERROR", message: "database password" } }, 500) : response({ items: [] })));
  render(<ActionsTaken ticketId={7} />);
  expect(await screen.findByRole("alert")).toHaveTextContent(/Unable to load Actions/i);
  expect(screen.queryByText(/database password/)).toBeNull();
  failed = false;
  await userEvent.click(screen.getByRole("button", { name: "Retry" }));
  expect(await screen.findByText(/No Actions have been recorded/i)).toBeInTheDocument();
});
