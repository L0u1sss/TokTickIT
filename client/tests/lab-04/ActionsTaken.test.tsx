import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { ActionsTaken } from "../../src/components/ActionsTaken.js";

const staff = [{ id: 2, displayName: "Mali Staff", email: "mali@example.test" }, { id: 3, displayName: "Niran Admin", email: "niran@example.test" }];
const first = { id: 11, description: "Checked the printer queue", result: null, status: "PLANNED", performedBy: staff[0], assignee: staff[0], followUpRequired: true, followUpNote: "Check again tomorrow", attachmentNotes: "See diagnostic.pdf", revision: 1, createdAt: "2026-09-25T09:00:00Z", updatedAt: "2026-09-25T09:00:00Z", completedAt: null };
const second = { ...first, id: 12, description: "Restarted print service", status: "COMPLETED", result: "Printing restored", assignee: staff[1], followUpRequired: false, followUpNote: null, attachmentNotes: null, revision: 2, createdAt: "2026-09-25T10:00:00Z", completedAt: "2026-09-25T10:05:00Z" };
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it("shows the stable Action list to a Requester without write controls", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => response({ items: [first, second] })));
  render(<ActionsTaken ticketId={7} />);
  expect(screen.getByRole("status")).toHaveTextContent("Loading Actions");
  const list = await screen.findByRole("list");
  expect(within(list).getAllByRole("listitem").map(item => item.textContent)).toEqual([
    expect.stringContaining("Checked the printer queue"), expect.stringContaining("Restarted print service"),
  ]);
  expect(screen.getByText("Check again tomorrow")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Add Action" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Edit Action" })).toBeNull();
});

it("validates, creates once, retains form values while saving, and refreshes", async () => {
  let items: typeof first[] = [], finish!: (value: Response) => void;
  const fetch = vi.fn(async (_url: string, init?: RequestInit) => {
    if (init?.method === "POST") return new Promise<Response>(resolve => { finish = resolve; });
    return response({ items });
  });
  vi.stubGlobal("fetch", fetch); render(<ActionsTaken ticketId={7} staff assignees={staff} />); await screen.findByText(/No Actions/);
  await userEvent.click(screen.getByRole("button", { name: "Add Action" }));
  await userEvent.click(screen.getByRole("button", { name: "Create Action" }));
  expect(screen.getByRole("alert")).toHaveTextContent("description");
  await userEvent.type(screen.getByLabelText("Create Action Description"), "Replaced toner");
  await userEvent.selectOptions(screen.getByLabelText("Create Action Assignee"), "2");
  await userEvent.click(screen.getByRole("checkbox", { name: /Follow-up required/ }));
  await userEvent.click(screen.getByRole("button", { name: "Create Action" }));
  expect(screen.getByRole("alert")).toHaveTextContent("Follow-up Note");
  await userEvent.type(screen.getByLabelText("Create Action Follow-up Note"), "Verify next shift");
  await userEvent.click(screen.getByRole("button", { name: "Create Action" }));
  expect(screen.getByLabelText("Create Action Description")).toHaveValue("Replaced toner");
  expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
  items = [{ ...first, description: "Replaced toner" }]; finish(response({ action: items[0], replayed: false }, 201));
  expect(await screen.findByRole("status")).toHaveTextContent("created successfully");
  await screen.findByText("Replaced toner");
  const post = fetch.mock.calls.find(([, init]) => init?.method === "POST");
  expect(JSON.parse(String(post?.[1]?.body))).toMatchObject({ description: "Replaced toner", assigneeId: 2, followUpRequired: true, followUpNote: "Verify next shift" });
  expect(fetch.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1);
});

it("edits assignment and applies allowed lifecycle transitions", async () => {
  let action = { ...first };
  const fetch = vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === "PATCH") { const body = JSON.parse(String(init.body)); action = { ...action, ...body, assignee: body.assigneeId ? staff[1] : action.assignee, revision: action.revision + 1 }; return response(action); }
    return response({ items: [action] });
  });
  vi.stubGlobal("fetch", fetch); render(<ActionsTaken ticketId={7} staff assignees={staff} />); await screen.findByText(first.description);
  await userEvent.click(screen.getByRole("button", { name: "Edit Action" }));
  await userEvent.selectOptions(screen.getByLabelText("Edit Action Assignee"), "3");
  await userEvent.type(screen.getByLabelText("Edit Action Result"), "Service ready");
  await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
  await screen.findByText("Niran Admin");
  await userEvent.click(screen.getByRole("button", { name: "Start Action" }));
  await screen.findByText("In progress");
  await userEvent.click(screen.getByRole("button", { name: "Complete Action" }));
  await screen.findByText("Completed");
  expect(fetch.mock.calls.filter(([, init]) => init?.method === "PATCH").map(([, init]) => JSON.parse(String(init?.body)))).toEqual(expect.arrayContaining([expect.objectContaining({ revision: 1, assigneeId: 3 }), expect.objectContaining({ status: "IN_PROGRESS", revision: 2 }), expect.objectContaining({ status: "COMPLETED", result: "Service ready", revision: 3 })]));
});

it("keeps an edit draft and offers reload after a stale conflict", async () => {
  vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => init?.method === "PATCH" ? response({ error: { code: "STALE_ACTION", message: "secret" } }, 409) : response({ items: [first] })));
  render(<ActionsTaken ticketId={7} staff assignees={staff} />); await screen.findByText(first.description);
  await userEvent.click(screen.getByRole("button", { name: "Edit Action" }));
  const description = screen.getByLabelText("Edit Action Description"); await userEvent.clear(description); await userEvent.type(description, "Unsaved local draft");
  await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Reload");
  expect(screen.getByLabelText("Edit Action Description")).toHaveValue("Unsaved local draft");
  expect(screen.queryByText("secret")).toBeNull(); expect(screen.getByRole("button", { name: "Reload Actions" })).toBeInTheDocument();
});

it("handles empty, failed and retry states safely", async () => {
  let failed = true;
  vi.stubGlobal("fetch", vi.fn(async () => failed ? response({ error: { code: "INTERNAL_ERROR", message: "database password" } }, 500) : response({ items: [] })));
  render(<ActionsTaken ticketId={7} />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load Actions"); expect(screen.queryByText(/database password/)).toBeNull();
  failed = false; await userEvent.click(screen.getByRole("button", { name: "Retry" }));
  expect(await screen.findByText(/No Actions have been recorded/)).toBeInTheDocument();
});
