import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { TicketWorkflow } from "../../src/components/TicketWorkflow.js";

const version = 7;
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it("shows only permitted transitions from the current status", () => {
  render(<TicketWorkflow ticketId={7} status="OPEN" expectedTicketVersion={version} onReload={vi.fn()} />);
  expect(within(screen.getByLabelText("Status")).getAllByRole("option").map(option => option.textContent)).toEqual([
    "Open", "In Progress", "Waiting For Requester", "Resolved", "Cancelled",
  ]);
});

it("confirms meaningful transitions and sends the shared Ticket version", async () => {
  let finish!: (value: Response) => void;
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false), reload = vi.fn(), fetch = vi.fn(async (...args: [string, RequestInit?]) => { void args; return new Promise<Response>(resolve => { finish = resolve; }); });
  vi.stubGlobal("fetch", fetch); render(<TicketWorkflow ticketId={7} status="OPEN" expectedTicketVersion={version} onReload={reload} />);
  await userEvent.selectOptions(screen.getByLabelText("Status"), "CANCELLED");
  expect(confirm).toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
  confirm.mockReturnValue(true); await userEvent.selectOptions(screen.getByLabelText("Status"), "CANCELLED");
  expect(await screen.findByRole("status")).toHaveTextContent("Changing status");
  await act(async () => { finish(response({ status: "CANCELLED", version: version + 1 })); });
  await vi.waitFor(() => expect(reload).toHaveBeenCalledOnce());
  expect(JSON.parse(String(fetch.mock.calls[0][1]?.body))).toEqual({ status: "CANCELLED", expectedTicketVersion: version });
});

it("explains the resolution gate and links to Actions Taken", async () => {
  vi.spyOn(window, "confirm").mockReturnValue(true);
  vi.stubGlobal("fetch", vi.fn(async () => response({ error: { code: "RESOLUTION_GATE_NOT_MET", message: "private detail" } }, 409)));
  render(<TicketWorkflow ticketId={7} status="OPEN" expectedTicketVersion={version} onReload={vi.fn()} />);
  await userEvent.selectOptions(screen.getByLabelText("Status"), "RESOLVED");
  const alert = await screen.findByRole("alert");
  expect(alert).toHaveTextContent("Complete at least one Action with a Result");
  expect(screen.getByRole("link", { name: "Review Actions Taken" })).toHaveAttribute("href", "#actions");
  expect(screen.queryByText("private detail")).toBeNull();
});

it("offers a Ticket reload after a stale conflict", async () => {
  const reload = vi.fn();
  vi.stubGlobal("fetch", vi.fn(async () => response({ error: { code: "STALE_TICKET", message: "database secret" } }, 409)));
  render(<TicketWorkflow ticketId={7} status="OPEN" expectedTicketVersion={version} onReload={reload} />);
  await userEvent.selectOptions(screen.getByLabelText("Status"), "IN_PROGRESS");
  expect(await screen.findByRole("alert")).toHaveTextContent("changed after you opened it");
  await userEvent.click(screen.getByRole("button", { name: "Reload Ticket" }));
  expect(reload).toHaveBeenCalledOnce(); expect(screen.queryByText("database secret")).toBeNull();
});

it("enables the updated matrix after a successful reload supplies the latest Ticket version", async () => {
  const reload = vi.fn();
  vi.stubGlobal("fetch", vi.fn(async () => response({ error: { code: "STALE_TICKET" } }, 409)));
  const view = render(<TicketWorkflow ticketId={7} status="OPEN" expectedTicketVersion={version} onReload={reload} />);
  await userEvent.selectOptions(screen.getByLabelText("Status"), "IN_PROGRESS");
  expect(await screen.findByRole("alert")).toBeVisible();
  expect(screen.getByLabelText("Status")).toBeDisabled();
  await userEvent.click(screen.getByRole("button", { name: "Reload Ticket" }));
  view.rerender(<TicketWorkflow ticketId={7} status="RESOLVED" expectedTicketVersion={version + 1} onReload={reload} />);
  expect(screen.getByLabelText("Status")).toBeEnabled();
  expect(within(screen.getByLabelText("Status")).getAllByRole("option").map(option => option.textContent)).toEqual(["Resolved", "Reopened", "Closed"]);
  expect(screen.queryByRole("alert")).toBeNull();
});

it("retains a failed transition for explicit retry", async () => {
  let fail = true; const reload = vi.fn();
  const fetch = vi.fn(async () => fail ? Promise.reject(new Error("offline")) : response({ status: "IN_PROGRESS", version: version + 1 }));
  vi.stubGlobal("fetch", fetch); render(<TicketWorkflow ticketId={7} status="OPEN" expectedTicketVersion={version} onReload={reload} />);
  await userEvent.selectOptions(screen.getByLabelText("Status"), "IN_PROGRESS");
  expect(await screen.findByRole("alert")).toHaveTextContent("Unable to change");
  fail = false; await userEvent.click(screen.getByRole("button", { name: "Retry status change" }));
  await vi.waitFor(() => expect(reload).toHaveBeenCalledOnce()); expect(fetch).toHaveBeenCalledTimes(2);
});

it("handles failed reloads safely and blocks repeated reload/retry while pending", async () => {
  let rejectReload!: (error: Error) => void;
  const reload = vi.fn(() => new Promise<void>((_resolve, reject) => { rejectReload = reject; }));
  vi.stubGlobal("fetch", vi.fn(async () => response({ error: { code: "STALE_TICKET" } }, 409)));
  render(<TicketWorkflow ticketId={7} status="OPEN" expectedTicketVersion={version} onReload={reload} />);
  await userEvent.selectOptions(screen.getByLabelText("Status"), "IN_PROGRESS");
  await screen.findByRole("alert");
  await userEvent.click(screen.getByRole("button", { name: "Reload Ticket" }));
  expect(screen.getByRole("button", { name: "Reload Ticket" })).toBeDisabled();
  await userEvent.click(screen.getByRole("button", { name: "Reload Ticket" }));
  expect(reload).toHaveBeenCalledOnce();
  await act(async () => { rejectReload(new Error("private database detail")); });
  await vi.waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Unable to reload the Ticket"));
  expect(screen.getByRole("button", { name: "Reload Ticket" })).toBeEnabled();
  expect(screen.queryByText("private database detail")).toBeNull();
});
